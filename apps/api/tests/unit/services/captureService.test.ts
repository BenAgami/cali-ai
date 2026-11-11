import { getPrismaClient, SessionStatus } from "@repo/db";
import type { PoseCapturePayload } from "@repo/common";

import {
  ConflictError,
  PreconditionRequiredError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../../../src/errors";

import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));

vi.mock("../../../src/services/aiPrerequisitesService", () => ({
  default: { assertAiPrerequisites: vi.fn() },
}));

vi.mock("../../../src/services/analysisStateService", () => ({
  default: {
    findOwnedSession: vi.fn(),
    startRunWithCapture: vi.fn(),
    restartRun: vi.fn(),
    failRun: vi.fn(),
  },
}));

vi.mock("../../../src/lib/queue", () => ({
  formAnalysisQueue: { add: vi.fn() },
  ANALYSIS_JOB_NAME: "analyze-capture",
}));

vi.mock("../../../src/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { CaptureService } = await import("../../../src/services/captureService");
const { default: analysisStateService } =
  await import("../../../src/services/analysisStateService");
const { default: aiPrerequisitesService } =
  await import("../../../src/services/aiPrerequisitesService");
const { formAnalysisQueue } = await import("../../../src/lib/queue");
const { logger } = await import("../../../src/lib/logger");

const USER = "user-uuid";
const USER_ID = 3;
const WORKOUT_ID = 9;
const EXERCISE_ID = 4;
const SESSION_ID = 7;
const JOB_ID_PATTERN = /^analysis-[0-9a-f-]{36}$/;

const payload: PoseCapturePayload = {
  version: 1,
  poseModelName: "movenet-lightning",
  poseModelVersion: "4",
  fps: 15,
  frameCount: 1,
  durationSec: 1,
  frames: [
    {
      timestampSec: 0,
      keypoints: Array.from(
        { length: 17 },
        () => [0.5, 0.5, 0.9] as [number, number, number],
      ),
    },
  ],
};

const snapshot = (processingStatus: SessionStatus) => ({
  id: SESSION_ID,
  processingStatus,
  analysisStage: null,
  analysisStageProgress: null,
  failureReason: null,
  bullmqJobId: null,
});

const stubPending = () => {
  vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
    snapshot(SessionStatus.PENDING),
  );
  vi.mocked(analysisStateService.startRunWithCapture).mockResolvedValue({
    captureId: 11,
  });
};

const stubFailed = () => {
  vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
    snapshot(SessionStatus.FAILED),
  );
  vi.mocked(analysisStateService.restartRun).mockResolvedValue({
    captureId: 11,
  });
};

describe("CaptureService", () => {
  let service: InstanceType<typeof CaptureService>;
  let prisma: PrismaMock;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrismaMock();
    vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
    prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
    prisma.poseCapture.count.mockResolvedValue(0);
    prisma.workoutSession.findUnique.mockResolvedValue({
      workoutId: WORKOUT_ID,
      exerciseId: EXERCISE_ID,
    });
    vi.mocked(aiPrerequisitesService.assertAiPrerequisites).mockResolvedValue(
      {} as never,
    );
    service = new CaptureService();
    vi.mocked(analysisStateService.failRun).mockResolvedValue(true);
  });

  describe("submitCapture", () => {
    it("stores the capture, enqueues the job and returns QUEUED", async () => {
      stubPending();
      vi.mocked(formAnalysisQueue.add).mockResolvedValue({} as never);

      const result = await service.submitCapture(USER, SESSION_ID, payload);

      const [, insert, jobId] = vi.mocked(
        analysisStateService.startRunWithCapture,
      ).mock.calls[0];
      expect(jobId).toMatch(JOB_ID_PATTERN);
      expect(result).toEqual({
        sessionId: SESSION_ID,
        captureId: 11,
        jobId,
        status: "QUEUED",
      });
      expect(insert).toMatchObject({
        keypointsFormat: "gzip-json-v1",
        poseModelName: "movenet-lightning",
        poseModelVersion: "4",
        fps: 15,
        frameCount: 1,
        durationSec: 1,
        cameraView: null,
        deviceModel: null,
        appVersion: null,
      });
      expect(insert.keypoints).toBeInstanceOf(Uint8Array);
      expect(formAnalysisQueue.add).toHaveBeenCalledWith(
        "analyze-capture",
        { sessionId: SESSION_ID, captureId: 11 },
        { jobId },
      );
    });

    it.each([SessionStatus.PROCESSING, SessionStatus.COMPLETED])(
      "rejects a %s session with 409",
      async (status) => {
        vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
          snapshot(status),
        );

        await expect(
          service.submitCapture(USER, SESSION_ID, payload),
        ).rejects.toThrow(
          new ConflictError("Analysis already started for this session"),
        );
        expect(analysisStateService.startRunWithCapture).not.toHaveBeenCalled();
        expect(formAnalysisQueue.add).not.toHaveBeenCalled();
      },
    );

    it("rejects a FAILED session with 409 and a retry hint", async () => {
      vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
        snapshot(SessionStatus.FAILED),
      );

      await expect(
        service.submitCapture(USER, SESSION_ID, payload),
      ).rejects.toThrow(
        new ConflictError("Analysis failed; retry the analysis"),
      );
      expect(analysisStateService.startRunWithCapture).not.toHaveBeenCalled();
    });
  });

  describe("submitCapture gating", () => {
    it("rejects with 428 and stores nothing when prerequisites are missing", async () => {
      stubPending();
      vi.mocked(aiPrerequisitesService.assertAiPrerequisites).mockRejectedValue(
        new PreconditionRequiredError("consent", "AI_CONSENT_REQUIRED"),
      );

      await expect(
        service.submitCapture(USER, SESSION_ID, payload),
      ).rejects.toBeInstanceOf(PreconditionRequiredError);
      expect(aiPrerequisitesService.assertAiPrerequisites).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(prisma.poseCapture.count).not.toHaveBeenCalled();
      expect(analysisStateService.startRunWithCapture).not.toHaveBeenCalled();
      expect(formAnalysisQueue.add).not.toHaveBeenCalled();
    });

    it("rejects with 429 DAILY_ANALYSIS_LIMIT_REACHED at the daily cap", async () => {
      vi.useFakeTimers({ now: new Date("2026-11-09T12:00:00Z") });
      try {
        stubPending();
        prisma.poseCapture.count.mockResolvedValue(15);

        const error: unknown = await service
          .submitCapture(USER, SESSION_ID, payload)
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(TooManyRequestsError);
        expect((error as TooManyRequestsError).code).toBe(
          "DAILY_ANALYSIS_LIMIT_REACHED",
        );
        expect(prisma.poseCapture.count).toHaveBeenCalledTimes(1);
        expect(prisma.poseCapture.count).toHaveBeenCalledWith({
          where: {
            session: { userId: USER_ID },
            createdAt: { gte: new Date("2026-11-08T12:00:00Z") },
          },
        });
        expect(analysisStateService.startRunWithCapture).not.toHaveBeenCalled();
        expect(formAnalysisQueue.add).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("rejects with 429 EXERCISE_ANALYSIS_LIMIT_REACHED at the per-exercise cap", async () => {
      stubPending();
      prisma.poseCapture.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      const error: unknown = await service
        .submitCapture(USER, SESSION_ID, payload)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(TooManyRequestsError);
      expect((error as TooManyRequestsError).code).toBe(
        "EXERCISE_ANALYSIS_LIMIT_REACHED",
      );
      expect(prisma.poseCapture.count).toHaveBeenLastCalledWith({
        where: {
          session: {
            userId: USER_ID,
            workoutId: WORKOUT_ID,
            exerciseId: EXERCISE_ID,
          },
        },
      });
      expect(analysisStateService.startRunWithCapture).not.toHaveBeenCalled();
    });

    it("checks the daily cap before the per-exercise cap", async () => {
      stubPending();
      prisma.poseCapture.count.mockResolvedValue(99);

      const error: unknown = await service
        .submitCapture(USER, SESSION_ID, payload)
        .catch((e: unknown) => e);

      expect((error as TooManyRequestsError).code).toBe(
        "DAILY_ANALYSIS_LIMIT_REACHED",
      );
    });

    it("skips the per-exercise cap for a session outside a workout", async () => {
      stubPending();
      vi.mocked(formAnalysisQueue.add).mockResolvedValue({} as never);
      prisma.workoutSession.findUnique.mockResolvedValue({
        workoutId: null,
        exerciseId: EXERCISE_ID,
      });

      await service.submitCapture(USER, SESSION_ID, payload);

      expect(prisma.poseCapture.count).toHaveBeenCalledTimes(1);
      expect(formAnalysisQueue.add).toHaveBeenCalled();
    });
  });

  describe("retryAnalysis", () => {
    it("requires AI prerequisites but ignores both caps", async () => {
      stubFailed();
      vi.mocked(formAnalysisQueue.add).mockResolvedValue({} as never);
      prisma.poseCapture.count.mockResolvedValue(999);

      await service.retryAnalysis(USER, SESSION_ID);

      expect(aiPrerequisitesService.assertAiPrerequisites).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(prisma.poseCapture.count).not.toHaveBeenCalled();
    });

    it("rejects a retry with 428 when prerequisites are missing", async () => {
      stubFailed();
      vi.mocked(aiPrerequisitesService.assertAiPrerequisites).mockRejectedValue(
        new PreconditionRequiredError("consent", "AI_CONSENT_REQUIRED"),
      );

      await expect(
        service.retryAnalysis(USER, SESSION_ID),
      ).rejects.toBeInstanceOf(PreconditionRequiredError);
      expect(analysisStateService.restartRun).not.toHaveBeenCalled();
    });

    it("restarts a FAILED run from the stored capture", async () => {
      vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
        snapshot(SessionStatus.FAILED),
      );
      vi.mocked(analysisStateService.restartRun).mockResolvedValue({
        captureId: 11,
      });
      vi.mocked(formAnalysisQueue.add).mockResolvedValue({} as never);

      const result = await service.retryAnalysis(USER, SESSION_ID);

      const jobId = vi.mocked(analysisStateService.restartRun).mock.calls[0][1];
      expect(jobId).toMatch(JOB_ID_PATTERN);
      expect(result).toEqual({
        sessionId: SESSION_ID,
        captureId: 11,
        jobId,
        status: "QUEUED",
      });
      expect(formAnalysisQueue.add).toHaveBeenCalledWith(
        "analyze-capture",
        { sessionId: SESSION_ID, captureId: 11 },
        { jobId },
      );
    });

    it.each([
      SessionStatus.PENDING,
      SessionStatus.PROCESSING,
      SessionStatus.COMPLETED,
    ])("rejects a %s session with 409", async (status) => {
      vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
        snapshot(status),
      );

      await expect(service.retryAnalysis(USER, SESSION_ID)).rejects.toThrow(
        new ConflictError("Only failed analyses can be retried"),
      );
      expect(analysisStateService.restartRun).not.toHaveBeenCalled();
    });
  });

  describe.each([
    {
      entryPoint: "submitCapture",
      arrange: stubPending,
      run: () => service.submitCapture(USER, SESSION_ID, payload),
      jobIdOf: () =>
        vi.mocked(analysisStateService.startRunWithCapture).mock.calls[0][2],
    },
    {
      entryPoint: "retryAnalysis",
      arrange: stubFailed,
      run: () => service.retryAnalysis(USER, SESSION_ID),
      jobIdOf: () =>
        vi.mocked(analysisStateService.restartRun).mock.calls[0][1],
    },
  ])("enqueue failures via $entryPoint", ({ arrange, run, jobIdOf }) => {
    it("fails the run and returns 503 when the enqueue rejects", async () => {
      arrange();
      const boom = new Error("redis down");
      vi.mocked(formAnalysisQueue.add).mockRejectedValue(boom);

      await expect(run()).rejects.toBeInstanceOf(ServiceUnavailableError);

      const jobId = jobIdOf();
      expect(analysisStateService.failRun).toHaveBeenCalledWith(
        SESSION_ID,
        jobId,
        "ENQUEUE_FAILED",
      );
      expect(logger.error).toHaveBeenCalledWith(
        { err: boom, sessionId: SESSION_ID, jobId },
        expect.any(String) as string,
      );
    });

    it("fails the run after 5000 ms when the enqueue never settles", async () => {
      vi.useFakeTimers();
      try {
        arrange();
        vi.mocked(formAnalysisQueue.add).mockReturnValue(
          new Promise(() => undefined),
        );

        const outcome = run().then(
          () => null,
          (error: unknown) => error,
        );
        await vi.waitFor(() =>
          expect(formAnalysisQueue.add).toHaveBeenCalled(),
        );
        await vi.advanceTimersByTimeAsync(5000);

        expect(await outcome).toBeInstanceOf(ServiceUnavailableError);
        expect(analysisStateService.failRun).toHaveBeenCalledWith(
          SESSION_ID,
          jobIdOf(),
          "ENQUEUE_FAILED",
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
