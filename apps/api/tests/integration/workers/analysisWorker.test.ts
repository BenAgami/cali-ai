import { randomUUID } from "node:crypto";

import type { Application } from "express";

import { type getPrismaClient, SessionStatus } from "@repo/db";
import type { PoseCapturePayload } from "@repo/common";

import { env } from "../../../src/config/env";
import { closeProgressBus } from "../../../src/lib/progressBus";
import {
  ANALYSIS_JOB_NAME,
  formAnalysisQueue,
  maintenanceQueue,
} from "../../../src/lib/queue";
import { redisConnection } from "../../../src/lib/redis";
import analysisStateService, {
  type CaptureInsert,
} from "../../../src/services/analysisStateService";
import {
  encodeCapture,
  KEYPOINTS_FORMAT,
} from "../../../src/utils/captureCodec";
import { startWorkers, stopWorkers } from "../../../src/workers";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

const buildPayload = (): PoseCapturePayload => ({
  version: 1,
  poseModelName: "movenet-lightning",
  poseModelVersion: "4",
  fps: 15,
  frameCount: 60,
  durationSec: 4,
  frames: Array.from({ length: 60 }, (_, i) => ({
    timestampSec: i / 15,
    keypoints: Array.from(
      { length: 17 },
      () => [0.5, 0.5, 0.9] as [number, number, number],
    ),
  })),
});

const captureInsert = (keypoints: Uint8Array): CaptureInsert => ({
  keypoints,
  keypointsFormat: KEYPOINTS_FORMAT,
  poseModelName: "movenet-lightning",
  poseModelVersion: "4",
  fps: 15,
  frameCount: 60,
  durationSec: 4,
  cameraView: null,
  deviceModel: null,
  appVersion: null,
});

describe("analysis worker (real Redis + Postgres)", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let userId: number;
  let exerciseId: number;

  const newJobId = () => `analysis-${randomUUID()}`;

  const createSession = async () =>
    prisma.workoutSession.create({
      data: { userId, exerciseId, processingStatus: SessionStatus.PENDING },
    });

  const reload = async (id: number) =>
    prisma.workoutSession.findUniqueOrThrow({ where: { id } });

  const waitForStatus = async (id: number, status: SessionStatus) =>
    vi.waitFor(
      async () => {
        expect((await reload(id)).processingStatus).toBe(status);
      },
      { timeout: 15_000, interval: 100 },
    );

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());

    const dto = new RegisterUserBuilder().build();
    await registerUser(app, dto);
    const user = await prisma.user.findFirstOrThrow({
      where: { email: dto.email },
    });
    userId = user.id;
    exerciseId = (await createExercise(prisma)).id;

    await formAnalysisQueue.obliterate({ force: true });
    await maintenanceQueue.obliterate({ force: true });
    await startWorkers();
  });

  afterAll(async () => {
    await stopWorkers();
    await formAnalysisQueue.obliterate({ force: true });
    await maintenanceQueue.obliterate({ force: true });
    await formAnalysisQueue.close();
    await maintenanceQueue.close();
    await closeProgressBus();
    await redisConnection.quit();
    await teardownIntegrationTest(prisma);
  });

  it("drives a valid capture to COMPLETED off the request path", async () => {
    const session = await createSession();
    const jobId = newJobId();
    const { captureId } = await analysisStateService.startRunWithCapture(
      session.id,
      captureInsert(await encodeCapture(buildPayload())),
      jobId,
    );

    await formAnalysisQueue.add(
      ANALYSIS_JOB_NAME,
      { sessionId: session.id, captureId },
      { jobId },
    );

    await waitForStatus(session.id, SessionStatus.COMPLETED);
    const row = await reload(session.id);
    expect(row.analysisStage).toBe("COMPLETED");
    expect(row.processingFinishedAt).not.toBeNull();
  });

  it("fails a corrupt capture with CAPTURE_INVALID and no retries", async () => {
    const session = await createSession();
    const jobId = newJobId();
    const { captureId } = await analysisStateService.startRunWithCapture(
      session.id,
      captureInsert(Buffer.from("not gzip")),
      jobId,
    );

    await formAnalysisQueue.add(
      ANALYSIS_JOB_NAME,
      { sessionId: session.id, captureId },
      { jobId },
    );

    await waitForStatus(session.id, SessionStatus.FAILED);
    const row = await reload(session.id);
    expect(row.failureReason).toBe("CAPTURE_INVALID");
    expect((await formAnalysisQueue.getJob(jobId))?.attemptsMade).toBe(1);
  });

  it("discards every write from a stale job whose id is not the session's run", async () => {
    const session = await createSession();
    const currentJobId = newJobId();
    const staleJobId = newJobId();
    const { captureId } = await analysisStateService.startRunWithCapture(
      session.id,
      captureInsert(await encodeCapture(buildPayload())),
      currentJobId,
    );

    await formAnalysisQueue.add(
      ANALYSIS_JOB_NAME,
      { sessionId: session.id, captureId },
      { jobId: staleJobId },
    );

    await vi.waitFor(
      async () => {
        expect(
          await (await formAnalysisQueue.getJob(staleJobId))?.isCompleted(),
        ).toBe(true);
      },
      { timeout: 15_000, interval: 100 },
    );

    const row = await reload(session.id);
    expect(row.processingStatus).toBe(SessionStatus.PROCESSING);
    expect(row.analysisStage).toBe("QUEUED");
    expect(row.bullmqJobId).toBe(currentJobId);
  });

  it("registers the reaper as a job scheduler", async () => {
    const schedulers = await maintenanceQueue.getJobSchedulers();

    expect(schedulers).toHaveLength(1);
    expect(schedulers[0]?.every).toBe(env.analysis.reaperIntervalMs);
  });
});
