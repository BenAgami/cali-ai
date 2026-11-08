import type { Application } from "express";

import { type getPrismaClient, SessionStatus } from "@repo/db";

import { ConflictError } from "../../../src/errors";
import { redisConnection } from "../../../src/lib/redis";
import { closeProgressBus } from "../../../src/lib/progressBus";
import {
  AnalysisStateService,
  type CaptureInsert,
} from "../../../src/services/analysisStateService";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

const captureFixture = (): CaptureInsert => ({
  keypoints: Buffer.from("x"),
  keypointsFormat: "gzip-json-v1",
  poseModelName: "movenet-lightning",
  poseModelVersion: "4",
  fps: 15,
  frameCount: 60,
  durationSec: 4,
  cameraView: null,
  deviceModel: null,
  appVersion: null,
});

describe("session processing status transitions", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let service: AnalysisStateService;
  let userId: number;
  let exerciseId: number;

  const createSession = async () =>
    prisma.workoutSession.create({
      data: { userId, exerciseId, processingStatus: SessionStatus.PENDING },
    });

  const reload = async (id: number) =>
    prisma.workoutSession.findUniqueOrThrow({ where: { id } });

  const captureCount = async (sessionId: number) =>
    prisma.poseCapture.count({ where: { sessionId } });

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    service = new AnalysisStateService();

    const dto = new RegisterUserBuilder().build();
    await registerUser(app, dto);
    const user = await prisma.user.findFirstOrThrow({
      where: { email: dto.email },
    });
    userId = user.id;
    exerciseId = (await createExercise(prisma)).id;
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
    await closeProgressBus();
    await redisConnection.quit();
  });

  it("moves PENDING -> PROCESSING with a QUEUED stage and one capture", async () => {
    const session = await createSession();

    const { captureId } = await service.startRunWithCapture(
      session.id,
      captureFixture(),
      "job-a",
    );

    const row = await reload(session.id);
    expect(captureId).toBeGreaterThan(0);
    expect(row.processingStatus).toBe(SessionStatus.PROCESSING);
    expect(row.analysisStage).toBe("QUEUED");
    expect(row.processingStartedAt).not.toBeNull();
    expect(row.bullmqJobId).toBe("job-a");
    expect(await captureCount(session.id)).toBe(1);
  });

  it("rejects a second start with ConflictError and keeps one capture", async () => {
    const session = await createSession();
    await service.startRunWithCapture(session.id, captureFixture(), "job-a");

    await expect(
      service.startRunWithCapture(session.id, captureFixture(), "job-b"),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await captureCount(session.id)).toBe(1);
    expect((await reload(session.id)).bullmqJobId).toBe("job-a");
  });

  it("lets exactly one of two concurrent starts win", async () => {
    const session = await createSession();

    const results = await Promise.allSettled([
      service.startRunWithCapture(session.id, captureFixture(), "job-1"),
      service.startRunWithCapture(session.id, captureFixture(), "job-2"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    expect(await captureCount(session.id)).toBe(1);
  });

  it("discards advanceStage for a different job id", async () => {
    const session = await createSession();
    await service.startRunWithCapture(session.id, captureFixture(), "job-a");

    await expect(
      service.advanceStage(session.id, "other-job", "ANALYZING_REPS", 0.5),
    ).resolves.toBe(false);

    const row = await reload(session.id);
    expect(row.analysisStage).toBe("QUEUED");
    expect(row.analysisStageProgress).toBeNull();
  });

  it("never moves the stage backwards", async () => {
    const session = await createSession();
    await service.startRunWithCapture(session.id, captureFixture(), "job-a");

    await expect(
      service.advanceStage(session.id, "job-a", "WRITING_FEEDBACK"),
    ).resolves.toBe(true);
    await expect(
      service.advanceStage(session.id, "job-a", "ANALYZING_REPS", 0.9),
    ).resolves.toBe(false);

    expect((await reload(session.id)).analysisStage).toBe("WRITING_FEEDBACK");
  });

  it("discards a failRun after completeRun", async () => {
    const session = await createSession();
    await service.startRunWithCapture(session.id, captureFixture(), "job-a");

    await expect(service.completeRun(session.id, "job-a")).resolves.toBe(true);
    const completed = await reload(session.id);
    expect(completed.processingStatus).toBe(SessionStatus.COMPLETED);
    expect(completed.processingFinishedAt).not.toBeNull();

    await expect(
      service.failRun(session.id, "job-a", "ANALYSIS_ERROR"),
    ).resolves.toBe(false);
    expect((await reload(session.id)).processingStatus).toBe(
      SessionStatus.COMPLETED,
    );
  });

  it("keeps the last reached stage when a run fails", async () => {
    const session = await createSession();
    await service.startRunWithCapture(session.id, captureFixture(), "job-a");
    await service.advanceStage(session.id, "job-a", "WRITING_FEEDBACK");

    await expect(
      service.failRun(session.id, "job-a", "LLM_TIMEOUT"),
    ).resolves.toBe(true);

    const row = await reload(session.id);
    expect(row.processingStatus).toBe(SessionStatus.FAILED);
    expect(row.analysisStage).toBe("WRITING_FEEDBACK");
    await expect(service.getStatusEvent(session.id)).resolves.toMatchObject({
      status: "FAILED",
      progress_percent: 60,
      failure_reason: "LLM_TIMEOUT",
    });
  });

  it("reaps only runs older than the stuck timeout", async () => {
    const stuck = await createSession();
    const fresh = await createSession();
    await service.startRunWithCapture(stuck.id, captureFixture(), "job-a");
    await service.startRunWithCapture(fresh.id, captureFixture(), "job-b");

    const now = Date.now();
    await prisma.workoutSession.update({
      where: { id: stuck.id },
      data: { processingStartedAt: new Date(now - 4 * 60_000) },
    });
    await prisma.workoutSession.update({
      where: { id: fresh.id },
      data: { processingStartedAt: new Date(now - 60_000) },
    });

    const reaped = await service.reapStuck(new Date(now));

    expect(reaped).toContain(stuck.id);
    expect(reaped).not.toContain(fresh.id);
    const stuckRow = await reload(stuck.id);
    expect(stuckRow.processingStatus).toBe(SessionStatus.FAILED);
    expect(stuckRow.failureReason).toBe("TIMEOUT");
    expect((await reload(fresh.id)).processingStatus).toBe(
      SessionStatus.PROCESSING,
    );
  });

  it("restarts a failed run that still has its capture", async () => {
    const session = await createSession();
    await service.startRunWithCapture(session.id, captureFixture(), "job-a");
    await service.failRun(session.id, "job-a", "ANALYSIS_ERROR");

    const { captureId } = await service.restartRun(session.id, "job-b");

    const row = await reload(session.id);
    expect(captureId).toBeGreaterThan(0);
    expect(row.processingStatus).toBe(SessionStatus.PROCESSING);
    expect(row.analysisStage).toBe("QUEUED");
    expect(row.failureReason).toBeNull();
    expect(row.bullmqJobId).toBe("job-b");

    await expect(
      service.restartRun(session.id, "job-c"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses to restart a failed run whose keypoints were purged", async () => {
    const session = await createSession();
    await service.startRunWithCapture(session.id, captureFixture(), "job-a");
    await service.failRun(session.id, "job-a", "ANALYSIS_ERROR");
    await prisma.poseCapture.updateMany({
      where: { sessionId: session.id },
      data: { keypoints: null },
    });

    await expect(
      service.restartRun(session.id, "job-b"),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await reload(session.id)).processingStatus).toBe(
      SessionStatus.FAILED,
    );
  });
});
