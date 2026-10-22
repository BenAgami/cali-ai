import { SessionStatus } from "@repo/db";
import type { PoseCapturePayload } from "@repo/common";

import { ConflictError, ServiceUnavailableError } from "../../../src/errors";

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
const { formAnalysisQueue } = await import("../../../src/lib/queue");
const { logger } = await import("../../../src/lib/logger");

const USER = "user-uuid";
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
      t: 0,
      kp: Array.from(
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

describe("CaptureService", () => {
  let service: InstanceType<typeof CaptureService>;

  beforeEach(() => {
    vi.clearAllMocks();
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
      ).mock.calls[0]!;
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

    it("points a FAILED session at the retry endpoint", async () => {
      vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
        snapshot(SessionStatus.FAILED),
      );

      await expect(
        service.submitCapture(USER, SESSION_ID, payload),
      ).rejects.toThrow(/retry/);
      expect(analysisStateService.startRunWithCapture).not.toHaveBeenCalled();
    });

    it("fails the run and returns 503 when the enqueue rejects", async () => {
      stubPending();
      const boom = new Error("redis down");
      vi.mocked(formAnalysisQueue.add).mockRejectedValue(boom);

      await expect(
        service.submitCapture(USER, SESSION_ID, payload),
      ).rejects.toBeInstanceOf(ServiceUnavailableError);

      const jobId = vi.mocked(analysisStateService.startRunWithCapture).mock
        .calls[0]![2];
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
        stubPending();
        vi.mocked(formAnalysisQueue.add).mockReturnValue(
          new Promise(() => undefined),
        );

        const outcome = service.submitCapture(USER, SESSION_ID, payload).then(
          () => null,
          (error: unknown) => error,
        );
        // encodeCapture uses real zlib, so wait until the enqueue has started.
        await vi.waitFor(() =>
          expect(formAnalysisQueue.add).toHaveBeenCalled(),
        );
        await vi.advanceTimersByTimeAsync(5000);

        expect(await outcome).toBeInstanceOf(ServiceUnavailableError);
        expect(analysisStateService.failRun).toHaveBeenCalledWith(
          SESSION_ID,
          expect.stringMatching(JOB_ID_PATTERN) as string,
          "ENQUEUE_FAILED",
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("retryAnalysis", () => {
    it("restarts a FAILED run from the stored capture", async () => {
      vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
        snapshot(SessionStatus.FAILED),
      );
      vi.mocked(analysisStateService.restartRun).mockResolvedValue({
        captureId: 11,
      });
      vi.mocked(formAnalysisQueue.add).mockResolvedValue({} as never);

      const result = await service.retryAnalysis(USER, SESSION_ID);

      const jobId = vi.mocked(analysisStateService.restartRun).mock
        .calls[0]![1];
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

    it("fails the run and returns 503 when the enqueue rejects", async () => {
      vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
        snapshot(SessionStatus.FAILED),
      );
      vi.mocked(analysisStateService.restartRun).mockResolvedValue({
        captureId: 11,
      });
      vi.mocked(formAnalysisQueue.add).mockRejectedValue(new Error("down"));

      await expect(
        service.retryAnalysis(USER, SESSION_ID),
      ).rejects.toBeInstanceOf(ServiceUnavailableError);
      expect(analysisStateService.failRun).toHaveBeenCalledWith(
        SESSION_ID,
        expect.stringMatching(JOB_ID_PATTERN) as string,
        "ENQUEUE_FAILED",
      );
    });
  });
});
