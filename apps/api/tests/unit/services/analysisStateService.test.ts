import { getPrismaClient, SessionStatus } from "@repo/db";

import { ConflictError, NotFoundError } from "../../../src/errors";

import {
  asPrismaClient,
  createPrismaMock,
  prismaError,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

vi.mock("../../../src/lib/progressBus", () => ({
  publishAnalysisEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../src/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { AnalysisStateService } =
  await import("../../../src/services/analysisStateService");
const { publishAnalysisEvent } = await import("../../../src/lib/progressBus");
const { logger } = await import("../../../src/lib/logger");

const NOW = new Date("2026-10-22T12:00:00Z");
const JOB = "job-1";

const capture = {
  keypoints: new Uint8Array([1, 2, 3]),
  keypointsFormat: "gzip-json-v1",
  poseModelName: "movenet-lightning",
  poseModelVersion: "4",
  fps: 15,
  frameCount: 60,
  durationSec: 4,
  cameraView: null,
  deviceModel: null,
  appVersion: null,
};

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  processingStatus: SessionStatus.PROCESSING,
  analysisStage: "QUEUED",
  analysisStageProgress: null,
  failureReason: null,
  bullmqJobId: JOB,
  ...overrides,
});

const RUN_RESET = {
  processingStatus: SessionStatus.PROCESSING,
  analysisStage: "QUEUED",
  analysisStageProgress: null,
  processingStartedAt: NOW,
  processingFinishedAt: null,
  failureReason: null,
  bullmqJobId: JOB,
};

let prisma: PrismaMock;
let service: InstanceType<typeof AnalysisStateService>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  vi.mocked(publishAnalysisEvent).mockResolvedValue(undefined);
  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  service = new AnalysisStateService();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AnalysisStateService.findOwnedSession", () => {
  it("looks the session up by id and owner", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workoutSession.findFirst.mockResolvedValue(snapshot());

    await expect(service.findOwnedSession("uuid-1", 5)).resolves.toEqual(
      snapshot(),
    );
    expect(prisma.workoutSession.findFirst).toHaveBeenCalledWith({
      where: { id: 5, userId: 42 },
      select: {
        id: true,
        processingStatus: true,
        analysisStage: true,
        analysisStageProgress: true,
        failureReason: true,
        bullmqJobId: true,
      },
    });
  });

  it("throws NotFoundError for a missing session", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 42 });
    prisma.workoutSession.findFirst.mockResolvedValue(null);

    await expect(service.findOwnedSession("uuid-1", 5)).rejects.toThrow(
      new NotFoundError("Workout session not found"),
    );
  });
});

describe("AnalysisStateService.startRunWithCapture", () => {
  it("guards on PENDING, then stores the capture and publishes QUEUED", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.poseCapture.create.mockResolvedValue({ id: 9 });
    prisma.workoutSession.findUnique.mockResolvedValue(snapshot());

    await expect(service.startRunWithCapture(5, capture, JOB)).resolves.toEqual(
      { captureId: 9 },
    );

    expect(prisma.workoutSession.updateMany).toHaveBeenCalledWith({
      where: { id: 5, processingStatus: SessionStatus.PENDING },
      data: RUN_RESET,
    });
    expect(prisma.poseCapture.create).toHaveBeenCalledWith({
      data: { sessionId: 5, ...capture },
      select: { id: true },
    });
    expect(publishAnalysisEvent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 5, status: "QUEUED" }),
    );
  });

  it("throws ConflictError and does not create a capture when the PENDING guard matches nothing", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.startRunWithCapture(5, capture, JOB)).rejects.toThrow(
      new ConflictError("Analysis already started for this session"),
    );
    expect(prisma.poseCapture.create).not.toHaveBeenCalled();
    expect(publishAnalysisEvent).not.toHaveBeenCalled();
  });

  it("maps a unique violation on the capture to ConflictError", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.poseCapture.create.mockRejectedValue(prismaError("P2002"));

    await expect(
      service.startRunWithCapture(5, capture, JOB),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rethrows other capture errors untouched", async () => {
    const boom = new Error("boom");
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.poseCapture.create.mockRejectedValue(boom);

    await expect(service.startRunWithCapture(5, capture, JOB)).rejects.toBe(
      boom,
    );
  });
});

describe("AnalysisStateService.restartRun", () => {
  it("requires a stored capture", async () => {
    prisma.poseCapture.findFirst.mockResolvedValue(null);

    await expect(service.restartRun(5, JOB)).rejects.toThrow(
      new ConflictError("No stored capture to retry for this session"),
    );
    expect(prisma.poseCapture.findFirst).toHaveBeenCalledWith({
      where: { sessionId: 5, keypoints: { not: null } },
      select: { id: true },
    });
    expect(prisma.workoutSession.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when the session is not FAILED", async () => {
    prisma.poseCapture.findFirst.mockResolvedValue({ id: 9 });
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.restartRun(5, JOB)).rejects.toThrow(
      new ConflictError("Only failed analyses can be retried"),
    );
  });

  it("resets the run from FAILED and publishes", async () => {
    prisma.poseCapture.findFirst.mockResolvedValue({ id: 9 });
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutSession.findUnique.mockResolvedValue(snapshot());

    await expect(service.restartRun(5, JOB)).resolves.toEqual({ captureId: 9 });
    expect(prisma.workoutSession.updateMany).toHaveBeenCalledWith({
      where: { id: 5, processingStatus: SessionStatus.FAILED },
      data: RUN_RESET,
    });
    expect(publishAnalysisEvent).toHaveBeenCalledTimes(1);
  });
});

describe("AnalysisStateService.advanceStage", () => {
  it("returns false for a stale job or non-PROCESSING session", async () => {
    prisma.workoutSession.findFirst.mockResolvedValue(null);

    await expect(
      service.advanceStage(5, "old", "ANALYZING_REPS"),
    ).resolves.toBe(false);
    expect(prisma.workoutSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 5,
        processingStatus: SessionStatus.PROCESSING,
        bullmqJobId: "old",
      },
      select: { analysisStage: true, analysisStageProgress: true },
    });
    expect(prisma.workoutSession.updateMany).not.toHaveBeenCalled();
  });

  it("never moves progress backwards", async () => {
    prisma.workoutSession.findFirst.mockResolvedValue({
      analysisStage: "WRITING_FEEDBACK",
      analysisStageProgress: null,
    });

    await expect(
      service.advanceStage(5, JOB, "ANALYZING_REPS", 0.9),
    ).resolves.toBe(false);
    expect(prisma.workoutSession.updateMany).not.toHaveBeenCalled();
  });

  it("writes the stage under the job guard and publishes", async () => {
    prisma.workoutSession.findFirst.mockResolvedValue({
      analysisStage: "QUEUED",
      analysisStageProgress: null,
    });
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutSession.findUnique.mockResolvedValue(
      snapshot({ analysisStage: "ANALYZING_REPS", analysisStageProgress: 0.5 }),
    );

    await expect(
      service.advanceStage(5, JOB, "ANALYZING_REPS", 0.5),
    ).resolves.toBe(true);
    expect(prisma.workoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 5,
        processingStatus: SessionStatus.PROCESSING,
        bullmqJobId: JOB,
      },
      data: { analysisStage: "ANALYZING_REPS", analysisStageProgress: 0.5 },
    });
    expect(publishAnalysisEvent).toHaveBeenCalledTimes(1);
  });

  it("stores null sub-progress when none is given", async () => {
    prisma.workoutSession.findFirst.mockResolvedValue({
      analysisStage: "QUEUED",
      analysisStageProgress: null,
    });
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.advanceStage(5, JOB, "WRITING_FEEDBACK"),
    ).resolves.toBe(false);
    expect(prisma.workoutSession.updateMany.mock.calls[0][0].data).toEqual({
      analysisStage: "WRITING_FEEDBACK",
      analysisStageProgress: null,
    });
    expect(publishAnalysisEvent).not.toHaveBeenCalled();
  });
});

describe("AnalysisStateService.completeRun", () => {
  it("completes under the job guard", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutSession.findUnique.mockResolvedValue(
      snapshot({ processingStatus: SessionStatus.COMPLETED }),
    );

    await expect(service.completeRun(5, JOB)).resolves.toBe(true);
    expect(prisma.workoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 5,
        processingStatus: SessionStatus.PROCESSING,
        bullmqJobId: JOB,
      },
      data: {
        processingStatus: SessionStatus.COMPLETED,
        analysisStage: "COMPLETED",
        analysisStageProgress: null,
        processingFinishedAt: NOW,
        failureReason: null,
      },
    });
    expect(publishAnalysisEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED", progress_percent: 100 }),
    );
  });

  it("discards a late write", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.completeRun(5, JOB)).resolves.toBe(false);
    expect(publishAnalysisEvent).not.toHaveBeenCalled();
  });
});

describe("AnalysisStateService.failRun", () => {
  it("fails under the job guard without touching analysisStage", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutSession.findUnique.mockResolvedValue(
      snapshot({
        processingStatus: SessionStatus.FAILED,
        failureReason: "ANALYSIS_ERROR",
      }),
    );

    await expect(service.failRun(5, JOB, "ANALYSIS_ERROR")).resolves.toBe(true);
    expect(prisma.workoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 5,
        processingStatus: SessionStatus.PROCESSING,
        bullmqJobId: JOB,
      },
      data: {
        processingStatus: SessionStatus.FAILED,
        processingFinishedAt: NOW,
        failureReason: "ANALYSIS_ERROR",
      },
    });
    expect(publishAnalysisEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILED" }),
    );
  });

  it("returns false when nothing matched", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.failRun(5, JOB, "TIMEOUT")).resolves.toBe(false);
  });
});

describe("AnalysisStateService.reapStuck", () => {
  const CUTOFF = new Date("2026-10-22T11:57:30Z");

  it("does nothing when no run is stuck", async () => {
    prisma.workoutSession.findMany.mockResolvedValue([]);

    await expect(service.reapStuck(NOW)).resolves.toEqual([]);
    expect(prisma.workoutSession.findMany).toHaveBeenCalledWith({
      where: {
        processingStatus: SessionStatus.PROCESSING,
        processingStartedAt: { lt: CUTOFF },
      },
      select: { id: true },
    });
    expect(prisma.workoutSession.updateMany).not.toHaveBeenCalled();
  });

  it("fails stuck runs with TIMEOUT and returns the ids actually failed", async () => {
    prisma.workoutSession.findMany.mockResolvedValue([{ id: 5 }, { id: 6 }]);
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutSession.findUnique
      .mockResolvedValueOnce(
        snapshot({
          id: 5,
          processingStatus: SessionStatus.FAILED,
          failureReason: "TIMEOUT",
        }),
      )
      .mockResolvedValueOnce(snapshot({ id: 6 }));

    await expect(service.reapStuck(NOW)).resolves.toEqual([5]);
    expect(prisma.workoutSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [5, 6] },
        processingStatus: SessionStatus.PROCESSING,
        processingStartedAt: { lt: CUTOFF },
      },
      data: {
        processingStatus: SessionStatus.FAILED,
        failureReason: "TIMEOUT",
        processingFinishedAt: NOW,
      },
    });
    expect(publishAnalysisEvent).toHaveBeenCalledTimes(1);
  });
});

describe("AnalysisStateService reads", () => {
  it("getCaptureForJob selects by capture and session", async () => {
    prisma.poseCapture.findFirst.mockResolvedValue({ id: 9 });

    await service.getCaptureForJob(5, 9);

    expect(prisma.poseCapture.findFirst).toHaveBeenCalledWith({
      where: { id: 9, sessionId: 5 },
      select: { id: true, keypoints: true, keypointsFormat: true },
    });
  });

  it("getAnalysisJobContext flattens the job context, or null when missing", async () => {
    prisma.workoutSession.findUnique.mockResolvedValueOnce({
      userId: 3,
      exercise: { code: "push_up", displayName: "Push-up" },
      user: { experienceLevel: "BEGINNER" },
    });
    await expect(service.getAnalysisJobContext(5)).resolves.toEqual({
      userId: 3,
      exerciseCode: "push_up",
      exerciseDisplayName: "Push-up",
      experienceLevel: "BEGINNER",
    });
    expect(prisma.workoutSession.findUnique).toHaveBeenCalledWith({
      where: { id: 5 },
      select: {
        userId: true,
        exercise: { select: { code: true, displayName: true } },
        user: { select: { experienceLevel: true } },
      },
    });

    prisma.workoutSession.findUnique.mockResolvedValueOnce(null);
    await expect(service.getAnalysisJobContext(5)).resolves.toBeNull();
  });

  it("getStatusEvent derives the event, or null for a missing session", async () => {
    prisma.workoutSession.findUnique.mockResolvedValueOnce(
      snapshot({ analysisStage: "WRITING_FEEDBACK" }),
    );
    await expect(service.getStatusEvent(5)).resolves.toMatchObject({
      sessionId: 5,
      status: "PROCESSING",
      progress_percent: 60,
    });

    prisma.workoutSession.findUnique.mockResolvedValueOnce(null);
    await expect(service.getStatusEvent(5)).resolves.toBeNull();
  });
});

describe("AnalysisStateService publishing", () => {
  it("logs a rejected publish as a warning and still succeeds", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutSession.findUnique.mockResolvedValue(
      snapshot({ processingStatus: SessionStatus.COMPLETED }),
    );
    vi.mocked(publishAnalysisEvent).mockRejectedValue(new Error("redis down"));

    await expect(service.completeRun(5, JOB)).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 5 }),
      "Failed to publish analysis status event",
    );
  });

  it("does not block on a publish that never settles", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutSession.findUnique.mockResolvedValue(
      snapshot({ processingStatus: SessionStatus.COMPLETED }),
    );
    vi.mocked(publishAnalysisEvent).mockReturnValue(new Promise(() => {}));

    await expect(service.completeRun(5, JOB)).resolves.toBe(true);
  });

  it("logs a failing snapshot read and still succeeds", async () => {
    prisma.workoutSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutSession.findUnique.mockRejectedValue(new Error("db"));

    await expect(service.completeRun(5, JOB)).resolves.toBe(true);
    expect(logger.warn).toHaveBeenCalled();
    expect(publishAnalysisEvent).not.toHaveBeenCalled();
  });
});
