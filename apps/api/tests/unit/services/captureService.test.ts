import { getPrismaClient, ProcessingStatus } from "@repo/db";
import type { PoseCapturePayload } from "@repo/common";

import {
  ConflictError,
  PreconditionRequiredError,
  ServiceUnavailableError,
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

vi.mock("../../../src/lib/progressBus", () => ({
  publishAnalysisEvent: vi.fn(),
}));

vi.mock(
  "../../../src/services/analysisStateService",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../src/services/analysisStateService")
    >()),
    default: {
      findOwnedRecordedSet: vi.fn(),
      startRunWithCapture: vi.fn(),
      restartRun: vi.fn(),
      failRun: vi.fn(),
    },
  }),
);

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
const RECORDED_SET_ID = 7;
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

const snapshot = (processingStatus: ProcessingStatus) => ({
  id: RECORDED_SET_ID,
  processingStatus,
  analysisStage: null,
  analysisStageProgress: null,
  failureReason: null,
  bullmqJobId: null,
  userId: USER_ID,
});

const stubPending = () => {
  vi.mocked(analysisStateService.findOwnedRecordedSet).mockResolvedValue(
    snapshot(ProcessingStatus.PENDING),
  );
  vi.mocked(analysisStateService.startRunWithCapture).mockResolvedValue({
    captureId: 11,
  });
};

const stubFailed = () => {
  vi.mocked(analysisStateService.findOwnedRecordedSet).mockResolvedValue(
    snapshot(ProcessingStatus.FAILED),
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
    prisma.poseCapture.count.mockResolvedValue(0);
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

      const result = await service.submitCapture(
        USER,
        RECORDED_SET_ID,
        payload,
      );

      const [, insert, jobId, ownerId] = vi.mocked(
        analysisStateService.startRunWithCapture,
      ).mock.calls[0];
      expect(jobId).toMatch(JOB_ID_PATTERN);
      expect(ownerId).toBe(USER_ID);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual({
        recordedSetId: RECORDED_SET_ID,
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
        { recordedSetId: RECORDED_SET_ID, captureId: 11 },
        { jobId },
      );
    });

    it.each([
      { status: ProcessingStatus.PROCESSING, expected: "QUEUED" },
      { status: ProcessingStatus.COMPLETED, expected: "COMPLETED" },
    ])(
      "answers a resend to a $status recorded set with status $expected",
      async ({ status, expected }) => {
        vi.mocked(analysisStateService.findOwnedRecordedSet).mockResolvedValue({
          ...snapshot(status),
          bullmqJobId: "analysis-existing",
        });
        prisma.poseCapture.findUnique.mockResolvedValue({ id: 11 });

        const result = await service.submitCapture(
          USER,
          RECORDED_SET_ID,
          payload,
        );

        expect(result).toEqual({
          recordedSetId: RECORDED_SET_ID,
          captureId: 11,
          jobId: "analysis-existing",
          status: expected,
        });
        expect(prisma.poseCapture.findUnique).toHaveBeenCalledWith({
          where: { recordedSetId: RECORDED_SET_ID },
          select: { id: true },
        });
        expect(analysisStateService.startRunWithCapture).not.toHaveBeenCalled();
        expect(formAnalysisQueue.add).not.toHaveBeenCalled();
      },
    );

    it("rejects a started recorded set with no stored capture with 409", async () => {
      vi.mocked(analysisStateService.findOwnedRecordedSet).mockResolvedValue({
        ...snapshot(ProcessingStatus.PROCESSING),
        bullmqJobId: "analysis-existing",
      });
      prisma.poseCapture.findUnique.mockResolvedValue(null);

      await expect(
        service.submitCapture(USER, RECORDED_SET_ID, payload),
      ).rejects.toThrow(
        new ConflictError("Analysis already started for this recorded set"),
      );
    });

    it("rejects a FAILED recorded set with 409 and a retry hint", async () => {
      vi.mocked(analysisStateService.findOwnedRecordedSet).mockResolvedValue(
        snapshot(ProcessingStatus.FAILED),
      );

      await expect(
        service.submitCapture(USER, RECORDED_SET_ID, payload),
      ).rejects.toMatchObject({
        message: "Analysis failed; retry the analysis",
        code: "ANALYSIS_FAILED",
      });
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
        service.submitCapture(USER, RECORDED_SET_ID, payload),
      ).rejects.toBeInstanceOf(PreconditionRequiredError);
      expect(aiPrerequisitesService.assertAiPrerequisites).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(analysisStateService.startRunWithCapture).not.toHaveBeenCalled();
      expect(formAnalysisQueue.add).not.toHaveBeenCalled();
    });
  });

  describe("retryAnalysis", () => {
    it("requires AI prerequisites and does not count toward the daily capture cap", async () => {
      stubFailed();
      vi.mocked(formAnalysisQueue.add).mockResolvedValue({} as never);
      prisma.poseCapture.count.mockResolvedValue(999);

      await service.retryAnalysis(USER, RECORDED_SET_ID);

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
        service.retryAnalysis(USER, RECORDED_SET_ID),
      ).rejects.toBeInstanceOf(PreconditionRequiredError);
      expect(analysisStateService.restartRun).not.toHaveBeenCalled();
    });

    it("restarts a FAILED run from the stored capture", async () => {
      vi.mocked(analysisStateService.findOwnedRecordedSet).mockResolvedValue(
        snapshot(ProcessingStatus.FAILED),
      );
      vi.mocked(analysisStateService.restartRun).mockResolvedValue({
        captureId: 11,
      });
      vi.mocked(formAnalysisQueue.add).mockResolvedValue({} as never);

      const result = await service.retryAnalysis(USER, RECORDED_SET_ID);

      const [, jobId, userId] = vi.mocked(analysisStateService.restartRun).mock
        .calls[0];
      expect(userId).toBe(USER_ID);
      expect(jobId).toMatch(JOB_ID_PATTERN);
      expect(result).toEqual({
        recordedSetId: RECORDED_SET_ID,
        captureId: 11,
        jobId,
        status: "QUEUED",
      });
      expect(formAnalysisQueue.add).toHaveBeenCalledWith(
        "analyze-capture",
        { recordedSetId: RECORDED_SET_ID, captureId: 11 },
        { jobId },
      );
    });

    it.each([
      ProcessingStatus.PENDING,
      ProcessingStatus.PROCESSING,
      ProcessingStatus.COMPLETED,
    ])("rejects a %s recorded set with 409", async (status) => {
      vi.mocked(analysisStateService.findOwnedRecordedSet).mockResolvedValue(
        snapshot(status),
      );

      await expect(
        service.retryAnalysis(USER, RECORDED_SET_ID),
      ).rejects.toThrow(
        new ConflictError("Only failed analyses can be retried"),
      );
      expect(analysisStateService.restartRun).not.toHaveBeenCalled();
    });
  });

  describe.each([
    {
      entryPoint: "submitCapture",
      arrange: stubPending,
      run: () => service.submitCapture(USER, RECORDED_SET_ID, payload),
      jobIdOf: () =>
        vi.mocked(analysisStateService.startRunWithCapture).mock.calls[0][2],
    },
    {
      entryPoint: "retryAnalysis",
      arrange: stubFailed,
      run: () => service.retryAnalysis(USER, RECORDED_SET_ID),
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
        RECORDED_SET_ID,
        jobId,
        "ENQUEUE_FAILED",
      );
      expect(logger.error).toHaveBeenCalledWith(
        { err: boom, recordedSetId: RECORDED_SET_ID, jobId },
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
          RECORDED_SET_ID,
          jobIdOf(),
          "ENQUEUE_FAILED",
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
