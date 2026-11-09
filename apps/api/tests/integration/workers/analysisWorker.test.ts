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

import { buildSyntheticCapture } from "../../unit/helpers/syntheticPose";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

const { generateFormFeedback } = vi.hoisted(() => ({
  generateFormFeedback: vi.fn(),
}));

// The LLM is an external I/O boundary; Postgres and Redis stay real.
vi.mock("../../../src/lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/llm")>()),
  getLlmProvider: () => ({ generateFormFeedback }),
}));

const buildPayload = (): PoseCapturePayload =>
  buildSyntheticCapture({ exercise: "push_up", reps: 5 });

const validDraft = () => ({
  feedback: {
    summary: "Steady, controlled set.",
    positives: [{ text: "Your tempo stayed steady", repNumbers: [1, 2] }],
    corrections: [],
  },
  model: "claude-sonnet-5-5",
  usage: { inputTokens: 100, outputTokens: 50 },
});

const invalidDraft = () => ({
  ...validDraft(),
  feedback: { summary: "No positives here.", positives: [], corrections: [] },
});

const captureInsert = (
  keypoints: Uint8Array,
  payload: PoseCapturePayload,
): CaptureInsert => ({
  keypoints,
  keypointsFormat: KEYPOINTS_FORMAT,
  poseModelName: payload.poseModelName,
  poseModelVersion: payload.poseModelVersion,
  fps: payload.fps,
  frameCount: payload.frameCount,
  durationSec: payload.durationSec,
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
      { timeout: 20_000, interval: 100 },
    );

  const enqueue = async (
    sessionId: number,
    payload: PoseCapturePayload,
    jobId = newJobId(),
  ) => {
    const { captureId } = await analysisStateService.startRunWithCapture(
      sessionId,
      captureInsert(await encodeCapture(payload), payload),
      jobId,
    );
    await formAnalysisQueue.add(
      ANALYSIS_JOB_NAME,
      { sessionId, captureId },
      { jobId },
    );
    return { captureId, jobId };
  };

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());

    const dto = new RegisterUserBuilder().build();
    await registerUser(app, dto);
    const user = await prisma.user.findFirstOrThrow({
      where: { email: dto.email },
    });
    userId = user.id;
    await grantAiPrerequisites(prisma, userId);
    exerciseId = (await createExercise(prisma, { code: "push_up" })).id;

    await formAnalysisQueue.obliterate({ force: true });
    await maintenanceQueue.obliterate({ force: true });
    await startWorkers();
  });

  beforeEach(() => {
    generateFormFeedback.mockReset();
    generateFormFeedback.mockResolvedValue(validDraft());
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

  it("scores a synthetic 5-rep push-up and stores one SCORED result", async () => {
    const session = await createSession();

    await enqueue(session.id, buildPayload());

    await waitForStatus(session.id, SessionStatus.COMPLETED);
    const row = await reload(session.id);
    expect(row.analysisStage).toBe("COMPLETED");
    expect(row.processingFinishedAt).not.toBeNull();

    const results = await prisma.analysisResult.findMany({
      where: { sessionId: session.id },
      include: { findings: true },
    });
    expect(results).toHaveLength(1);
    const [result] = results;
    expect(result?.outcome).toBe("SCORED");
    expect(result?.formScore).toBeGreaterThanOrEqual(0);
    expect(result?.formScore).toBeLessThanOrEqual(100);
    const findings = result?.findings ?? [];
    expect(
      findings.filter((f) => f.findingType === "POSITIVE").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      findings.filter((f) => f.findingType === "CORRECTION").length,
    ).toBeLessThanOrEqual(2);
    for (const finding of findings) {
      for (const rep of finding.repNumbers) {
        expect(rep).toBeGreaterThanOrEqual(1);
        expect(rep).toBeLessThanOrEqual(5);
      }
    }
  });

  it("completes a 1-rep capture as UNTRACKABLE without calling the LLM", async () => {
    const session = await createSession();

    await enqueue(
      session.id,
      buildSyntheticCapture({ exercise: "push_up", reps: 1 }),
    );

    await waitForStatus(session.id, SessionStatus.COMPLETED);
    const result = await prisma.analysisResult.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    expect(result.outcome).toBe("UNTRACKABLE");
    expect(result.formScore).toBeNull();
    expect(result.untrackableReasons).toContain("NO_REPS_DETECTED");
    expect(generateFormFeedback).not.toHaveBeenCalled();
  });

  it("fails a 17-keypoint capture with CAPTURE_INVALID", async () => {
    const session = await createSession();
    const synthetic = buildPayload();
    const legacy: PoseCapturePayload = {
      ...synthetic,
      poseModelName: "movenet-lightning",
      poseModelVersion: "4",
      frames: synthetic.frames.map((frame) => ({
        ...frame,
        keypoints: frame.keypoints.slice(0, 17),
      })),
    };

    await enqueue(session.id, legacy);

    await waitForStatus(session.id, SessionStatus.FAILED);
    expect((await reload(session.id)).failureReason).toBe("CAPTURE_INVALID");
    expect(
      await prisma.analysisResult.count({ where: { sessionId: session.id } }),
    ).toBe(0);
  });

  it("fails with ANALYSIS_ERROR on invalid drafts, then a retry yields exactly one result", async () => {
    const session = await createSession();
    generateFormFeedback.mockReset();
    generateFormFeedback
      .mockResolvedValueOnce(invalidDraft())
      .mockResolvedValueOnce(invalidDraft());

    await enqueue(session.id, buildPayload());

    await waitForStatus(session.id, SessionStatus.FAILED);
    expect((await reload(session.id)).failureReason).toBe("ANALYSIS_ERROR");
    expect(
      await prisma.analysisResult.count({ where: { sessionId: session.id } }),
    ).toBe(0);

    generateFormFeedback.mockReset();
    generateFormFeedback.mockResolvedValue(validDraft());
    const retryJobId = newJobId();
    const { captureId } = await analysisStateService.restartRun(
      session.id,
      retryJobId,
    );
    await formAnalysisQueue.add(
      ANALYSIS_JOB_NAME,
      { sessionId: session.id, captureId },
      { jobId: retryJobId },
    );

    await waitForStatus(session.id, SessionStatus.COMPLETED);
    const results = await prisma.analysisResult.findMany({
      where: { sessionId: session.id },
      include: { findings: true },
    });
    expect(results).toHaveLength(1);
    expect(
      results[0]?.findings.filter((f) => f.findingType === "POSITIVE"),
    ).toHaveLength(1);
  });

  it("fails a corrupt capture with CAPTURE_INVALID and no retries", async () => {
    const session = await createSession();
    const jobId = newJobId();
    const { captureId } = await analysisStateService.startRunWithCapture(
      session.id,
      captureInsert(Buffer.from("not gzip"), buildPayload()),
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
    const payload = buildPayload();
    const { captureId } = await analysisStateService.startRunWithCapture(
      session.id,
      captureInsert(await encodeCapture(payload), payload),
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
      { timeout: 20_000, interval: 100 },
    );

    const row = await reload(session.id);
    expect(row.processingStatus).toBe(SessionStatus.PROCESSING);
    expect(row.analysisStage).toBe("QUEUED");
    expect(row.bullmqJobId).toBe(currentJobId);
    expect(
      await prisma.analysisResult.count({ where: { sessionId: session.id } }),
    ).toBe(0);
  });

  it("registers the reaper as a job scheduler", async () => {
    const schedulers = await maintenanceQueue.getJobSchedulers();

    expect(schedulers).toHaveLength(1);
    expect(schedulers[0]?.every).toBe(env.analysis.reaperIntervalMs);
  });
});
