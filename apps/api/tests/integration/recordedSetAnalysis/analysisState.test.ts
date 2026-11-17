import type { Application } from "express";

import { type getPrismaClient, ProcessingStatus } from "@repo/db";

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

describe("recorded set processing status transitions", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let service: AnalysisStateService;
  let userId: number;
  let exerciseId: number;

  const createRecordedSet = async () =>
    prisma.recordedSet.create({
      data: { userId, exerciseId, processingStatus: ProcessingStatus.PENDING },
    });

  const reload = async (id: number) =>
    prisma.recordedSet.findUniqueOrThrow({ where: { id } });

  const captureCount = async (recordedSetId: number) =>
    prisma.poseCapture.count({ where: { recordedSetId } });

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
    const recordedSet = await createRecordedSet();

    const { captureId } = await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );

    const row = await reload(recordedSet.id);
    expect(captureId).toBeGreaterThan(0);
    expect(row.processingStatus).toBe(ProcessingStatus.PROCESSING);
    expect(row.analysisStage).toBe("QUEUED");
    expect(row.processingStartedAt).not.toBeNull();
    expect(row.bullmqJobId).toBe("job-a");
    expect(await captureCount(recordedSet.id)).toBe(1);
  });

  it("rejects a second start with ConflictError and keeps one capture", async () => {
    const recordedSet = await createRecordedSet();
    await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );

    await expect(
      service.startRunWithCapture(
        recordedSet.id,
        captureFixture(),
        "job-b",
        userId,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await captureCount(recordedSet.id)).toBe(1);
    expect((await reload(recordedSet.id)).bullmqJobId).toBe("job-a");
  });

  it("lets exactly one of two concurrent starts win", async () => {
    const recordedSet = await createRecordedSet();

    const results = await Promise.allSettled([
      service.startRunWithCapture(
        recordedSet.id,
        captureFixture(),
        "job-1",
        userId,
      ),
      service.startRunWithCapture(
        recordedSet.id,
        captureFixture(),
        "job-2",
        userId,
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictError);
    expect(await captureCount(recordedSet.id)).toBe(1);
  });

  it("discards advanceStage for a different job id", async () => {
    const recordedSet = await createRecordedSet();
    await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );

    await expect(
      service.advanceStage(recordedSet.id, "other-job", "ANALYZING_REPS", 0.5),
    ).resolves.toBe(false);

    const row = await reload(recordedSet.id);
    expect(row.analysisStage).toBe("QUEUED");
    expect(row.analysisStageProgress).toBeNull();
  });

  it("never moves the stage backwards", async () => {
    const recordedSet = await createRecordedSet();
    await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );

    await expect(
      service.advanceStage(recordedSet.id, "job-a", "WRITING_FEEDBACK"),
    ).resolves.toBe(true);
    await expect(
      service.advanceStage(recordedSet.id, "job-a", "ANALYZING_REPS", 0.9),
    ).resolves.toBe(false);

    expect((await reload(recordedSet.id)).analysisStage).toBe(
      "WRITING_FEEDBACK",
    );
  });

  it("discards a failRun after completeRun", async () => {
    const recordedSet = await createRecordedSet();
    await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );

    await expect(
      service.completeRunWithResult(recordedSet.id, "job-a", async () => {}),
    ).resolves.toBe(true);
    const completed = await reload(recordedSet.id);
    expect(completed.processingStatus).toBe(ProcessingStatus.COMPLETED);
    expect(completed.processingFinishedAt).not.toBeNull();

    await expect(
      service.failRun(recordedSet.id, "job-a", "ANALYSIS_ERROR"),
    ).resolves.toBe(false);
    expect((await reload(recordedSet.id)).processingStatus).toBe(
      ProcessingStatus.COMPLETED,
    );
  });

  it("rolls back the result and the COMPLETED flip when the result write fails", async () => {
    const recordedSet = await createRecordedSet();
    await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );

    // Before completeRunWithResult the result was saved in its own transaction
    // and COMPLETED flipped afterwards, so a crash in between left a stored
    // result on a PROCESSING recorded set. Both now commit or neither does.
    await expect(
      service.completeRunWithResult(recordedSet.id, "job-a", async (tx) => {
        await tx.analysisResult.create({
          data: { recordedSetId: recordedSet.id },
        });
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");

    expect((await reload(recordedSet.id)).processingStatus).toBe(
      ProcessingStatus.PROCESSING,
    );
    await expect(
      prisma.analysisResult.count({ where: { recordedSetId: recordedSet.id } }),
    ).resolves.toBe(0);
  });

  it("writes nothing when the job no longer owns the run", async () => {
    const recordedSet = await createRecordedSet();
    await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );
    const write = vi.fn();

    await expect(
      service.completeRunWithResult(recordedSet.id, "job-stale", write),
    ).resolves.toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it("keeps the last reached stage when a run fails", async () => {
    const recordedSet = await createRecordedSet();
    await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );
    await service.advanceStage(recordedSet.id, "job-a", "WRITING_FEEDBACK");

    await expect(
      service.failRun(recordedSet.id, "job-a", "LLM_TIMEOUT"),
    ).resolves.toBe(true);

    const row = await reload(recordedSet.id);
    expect(row.processingStatus).toBe(ProcessingStatus.FAILED);
    expect(row.analysisStage).toBe("WRITING_FEEDBACK");
    await expect(service.getStatusEvent(recordedSet.id)).resolves.toMatchObject(
      {
        status: "FAILED",
        progress_percent: 60,
        failure_reason: "LLM_TIMEOUT",
      },
    );
  });

  it("reaps only runs older than the stuck timeout", async () => {
    const stuck = await createRecordedSet();
    const fresh = await createRecordedSet();
    await service.startRunWithCapture(
      stuck.id,
      captureFixture(),
      "job-a",
      userId,
    );
    await service.startRunWithCapture(
      fresh.id,
      captureFixture(),
      "job-b",
      userId,
    );

    const now = Date.now();
    await prisma.recordedSet.update({
      where: { id: stuck.id },
      data: { processingStartedAt: new Date(now - 4 * 60_000) },
    });
    await prisma.recordedSet.update({
      where: { id: fresh.id },
      data: { processingStartedAt: new Date(now - 60_000) },
    });

    const reaped = await service.reapStuck(new Date(now));

    expect(reaped).toContain(stuck.id);
    expect(reaped).not.toContain(fresh.id);
    const stuckRow = await reload(stuck.id);
    expect(stuckRow.processingStatus).toBe(ProcessingStatus.FAILED);
    expect(stuckRow.failureReason).toBe("TIMEOUT");
    expect((await reload(fresh.id)).processingStatus).toBe(
      ProcessingStatus.PROCESSING,
    );
  });

  it("restarts a failed run that still has its capture", async () => {
    const recordedSet = await createRecordedSet();
    await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );
    await service.failRun(recordedSet.id, "job-a", "ANALYSIS_ERROR");

    const { captureId } = await service.restartRun(
      recordedSet.id,
      "job-b",
      userId,
    );

    const row = await reload(recordedSet.id);
    expect(captureId).toBeGreaterThan(0);
    expect(row.processingStatus).toBe(ProcessingStatus.PROCESSING);
    expect(row.analysisStage).toBe("QUEUED");
    expect(row.failureReason).toBeNull();
    expect(row.bullmqJobId).toBe("job-b");

    await expect(
      service.restartRun(recordedSet.id, "job-c", userId),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses to restart a failed run whose keypoints were purged", async () => {
    const recordedSet = await createRecordedSet();
    await service.startRunWithCapture(
      recordedSet.id,
      captureFixture(),
      "job-a",
      userId,
    );
    await service.failRun(recordedSet.id, "job-a", "ANALYSIS_ERROR");
    await prisma.poseCapture.updateMany({
      where: { recordedSetId: recordedSet.id },
      data: { keypoints: null },
    });

    await expect(
      service.restartRun(recordedSet.id, "job-b", userId),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await reload(recordedSet.id)).processingStatus).toBe(
      ProcessingStatus.FAILED,
    );
  });
});
