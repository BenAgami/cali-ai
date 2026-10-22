import { UnrecoverableError } from "bullmq";
import type { PoseCapturePayload } from "@repo/common";

import {
  encodeCapture,
  KEYPOINTS_FORMAT,
} from "../../../src/utils/captureCodec";
import { TimeoutError } from "../../../src/utils/withTimeout";
import { createFakeJob } from "../helpers/bullmqJob";

const mockState = vi.hoisted(() => ({
  getCaptureForJob: vi.fn(),
  advanceStage: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
}));
const mockFeedback = vi.hoisted(() => ({ generateFeedback: vi.fn() }));
const mockChild = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const mockLogger = vi.hoisted(() => ({ child: vi.fn() }));

vi.mock("../../../src/services/analysisStateService", () => ({
  default: mockState,
}));
vi.mock("../../../src/services/feedbackService", () => ({
  default: mockFeedback,
}));
vi.mock("../../../src/lib/logger", () => ({ logger: mockLogger }));

import {
  onAnalysisJobFailed,
  processAnalysisJob,
} from "../../../src/workers/analysisProcessor";

type JobData = { sessionId: number; captureId: number };

const payload = (): PoseCapturePayload => ({
  version: 1,
  poseModelName: "movenet-lightning",
  poseModelVersion: "4",
  fps: 15,
  frameCount: 2,
  durationSec: 1,
  frames: [0, 100].map((t) => ({
    t,
    kp: Array.from(
      { length: 17 },
      () => [0.5, 0.5, 0.8] as [number, number, number],
    ),
  })),
});

const makeJob = (extra: { attemptsMade?: number; attempts?: number } = {}) =>
  createFakeJob<JobData>({
    id: "job-1",
    data: { sessionId: 7, captureId: 9 },
    ...extra,
  });

beforeEach(() => {
  vi.resetAllMocks();
  mockLogger.child.mockReturnValue(mockChild);
  mockState.advanceStage.mockResolvedValue(true);
  mockState.completeRun.mockResolvedValue(true);
  mockState.failRun.mockResolvedValue(true);
  mockFeedback.generateFeedback.mockResolvedValue({ summary: "ok" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("processAnalysisJob", () => {
  const withCapture = async () =>
    mockState.getCaptureForJob.mockResolvedValue({
      id: 9,
      keypoints: await encodeCapture(payload()),
      keypointsFormat: KEYPOINTS_FORMAT,
    });

  it("advances stages, generates feedback and completes the run", async () => {
    await withCapture();

    await processAnalysisJob(makeJob());

    expect(mockLogger.child).toHaveBeenCalledTimes(1);
    expect(mockLogger.child).toHaveBeenCalledWith({
      jobId: "job-1",
      sessionId: 7,
    });
    expect(mockState.getCaptureForJob).toHaveBeenCalledWith(7, 9);
    expect(mockState.advanceStage.mock.calls).toEqual([
      [7, "job-1", "ANALYZING_REPS", 0, mockChild],
      [7, "job-1", "ANALYZING_REPS", 1, mockChild],
      [7, "job-1", "WRITING_FEEDBACK", 0, mockChild],
    ]);
    expect(mockFeedback.generateFeedback).toHaveBeenCalledWith({
      frameCount: 2,
      keypointsPerFrame: 17,
      meanConfidence: expect.closeTo(0.8, 5) as number,
    });
    expect(mockState.completeRun).toHaveBeenCalledWith(7, "job-1", mockChild);
  });

  it("fails unrecoverably with CAPTURE_MISSING when no capture exists", async () => {
    mockState.getCaptureForJob.mockResolvedValue(null);

    const result = processAnalysisJob(makeJob());

    await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(result).rejects.toThrow("CAPTURE_MISSING");
    expect(mockState.advanceStage).not.toHaveBeenCalled();
  });

  it("fails unrecoverably with CAPTURE_MISSING when keypoints are null", async () => {
    mockState.getCaptureForJob.mockResolvedValue({
      id: 9,
      keypoints: null,
      keypointsFormat: KEYPOINTS_FORMAT,
    });

    await expect(processAnalysisJob(makeJob())).rejects.toThrow(
      "CAPTURE_MISSING",
    );
    expect(mockState.advanceStage).not.toHaveBeenCalled();
  });

  it("fails unrecoverably with CAPTURE_INVALID for a corrupt blob", async () => {
    mockState.getCaptureForJob.mockResolvedValue({
      id: 9,
      keypoints: Buffer.from("not gzip"),
      keypointsFormat: KEYPOINTS_FORMAT,
    });

    const result = processAnalysisJob(makeJob());

    await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(result).rejects.toThrow("CAPTURE_INVALID");
  });

  it("rejects with a retryable LLM_TIMEOUT when feedback never settles", async () => {
    await withCapture();
    mockFeedback.generateFeedback.mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers();

    const result = processAnalysisJob(makeJob());
    const assertion = expect(result).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof TimeoutError &&
        error.code === "LLM_TIMEOUT" &&
        !(error instanceof UnrecoverableError),
    );
    // Decoding gunzips on the real thread pool; wait until the timeout is armed.
    await vi.waitFor(() =>
      expect(mockFeedback.generateFeedback).toHaveBeenCalled(),
    );
    await vi.advanceTimersByTimeAsync(40_000);

    await assertion;
    expect(mockState.completeRun).not.toHaveBeenCalled();
  });

  it("logs a warning when the completion write was discarded", async () => {
    await withCapture();
    mockState.completeRun.mockResolvedValue(false);

    await processAnalysisJob(makeJob());

    expect(mockChild.warn).toHaveBeenCalledWith(
      expect.stringContaining("discarded"),
    );
  });
});

describe("onAnalysisJobFailed", () => {
  it("ignores an undefined job", async () => {
    await onAnalysisJobFailed(undefined, new Error("x"));

    expect(mockState.failRun).not.toHaveBeenCalled();
    expect(mockLogger.child).not.toHaveBeenCalled();
  });

  it("only warns while attempts remain", async () => {
    await onAnalysisJobFailed(makeJob({ attemptsMade: 1 }), new Error("x"));

    expect(mockState.failRun).not.toHaveBeenCalled();
    expect(mockChild.warn).toHaveBeenCalled();
  });

  it("fails the run with ANALYSIS_ERROR after the last attempt", async () => {
    await onAnalysisJobFailed(makeJob({ attemptsMade: 3 }), new Error("x"));

    expect(mockState.failRun).toHaveBeenCalledWith(
      7,
      "job-1",
      "ANALYSIS_ERROR",
      mockChild,
    );
  });

  it("fails immediately with the coded reason for unrecoverable errors", async () => {
    await onAnalysisJobFailed(
      makeJob({ attemptsMade: 1 }),
      new UnrecoverableError("CAPTURE_INVALID"),
    );

    expect(mockState.failRun).toHaveBeenCalledWith(
      7,
      "job-1",
      "CAPTURE_INVALID",
      mockChild,
    );
  });

  it("maps an exhausted LLM timeout to LLM_TIMEOUT", async () => {
    await onAnalysisJobFailed(
      makeJob({ attemptsMade: 3 }),
      new TimeoutError("LLM_TIMEOUT", 40_000),
    );

    expect(mockState.failRun).toHaveBeenCalledWith(
      7,
      "job-1",
      "LLM_TIMEOUT",
      mockChild,
    );
  });

  it("maps an unknown unrecoverable message to ANALYSIS_ERROR", async () => {
    await onAnalysisJobFailed(
      makeJob({ attemptsMade: 1 }),
      new UnrecoverableError("something else"),
    );

    expect(mockState.failRun).toHaveBeenCalledWith(
      7,
      "job-1",
      "ANALYSIS_ERROR",
      mockChild,
    );
  });
});
