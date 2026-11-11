import { UnrecoverableError } from "bullmq";
import type { PoseCapturePayload } from "@repo/common";

import { LlmError } from "../../../src/lib/llm/types";
import { UnsupportedCaptureError } from "../../../src/metrics/preprocess";
import {
  encodeCapture,
  KEYPOINTS_FORMAT,
} from "../../../src/utils/captureCodec";
import { createFakeJob } from "../helpers/bullmqJob";
import { makeScoredMetrics } from "../helpers/scoredMetrics";

const mockState = vi.hoisted(() => ({
  getCaptureForJob: vi.fn(),
  getAnalysisJobContext: vi.fn(),
  advanceStage: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
}));
const mockFeedback = vi.hoisted(() => ({ generateFormFeedback: vi.fn() }));
const mockResults = vi.hoisted(() => ({
  saveScored: vi.fn(),
  saveUntrackable: vi.fn(),
}));
const mockBodyMetric = vi.hoisted(() => ({ getLatest: vi.fn() }));
const mockCompute = vi.hoisted(() => ({ computeFormMetrics: vi.fn() }));
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
vi.mock("../../../src/services/formAnalysisResultService", () => ({
  default: mockResults,
}));
vi.mock("../../../src/services/bodyMetricService", () => ({
  default: mockBodyMetric,
}));
vi.mock("../../../src/metrics/computeFormMetrics", () => mockCompute);
vi.mock("../../../src/lib/logger", () => ({ logger: mockLogger }));

import {
  onAnalysisJobFailed,
  processAnalysisJob,
} from "../../../src/workers/analysisProcessor";

type JobData = { sessionId: number; captureId: number };

const LLM_TIMEOUT_MS = 40_000;

const payload = (): PoseCapturePayload => ({
  version: 1,
  poseModelName: "blazepose-lite",
  poseModelVersion: "1",
  fps: 15,
  frameCount: 2,
  durationSec: 1,
  frames: [0, 0.1].map((timestampSec) => ({
    timestampSec,
    keypoints: Array.from(
      { length: 33 },
      () => [0.5, 0.5, 0.8] as [number, number, number],
    ),
  })),
});

const outcome = {
  feedback: { summary: "ok", positives: [], corrections: [] },
  model: "claude-sonnet-5-5",
  promptVersion: "form-feedback-v1",
  usage: { inputTokens: 1, outputTokens: 1 },
  attempts: 1,
};

const untrackable = {
  outcome: "UNTRACKABLE" as const,
  exerciseCode: "push_up" as const,
  reasons: ["NO_REPS_DETECTED" as const],
  metricsVersion: "metrics-v1",
  rubricVersion: "rubric-v0",
};

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
  mockState.getAnalysisJobContext.mockResolvedValue({
    userId: 3,
    exerciseCode: "push_up",
    exerciseDisplayName: "Push-up",
    experienceLevel: "BEGINNER",
  });
  mockBodyMetric.getLatest.mockResolvedValue({
    heightCm: 180,
    weightKg: 75,
    createdAt: new Date(),
  });
  mockCompute.computeFormMetrics.mockReturnValue(makeScoredMetrics());
  mockFeedback.generateFormFeedback.mockResolvedValue(outcome);
  mockResults.saveScored.mockResolvedValue(true);
  mockResults.saveUntrackable.mockResolvedValue(true);
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

  it("scores the set: stages, LLM call with signal and context, save, complete", async () => {
    await withCapture();
    vi.useFakeTimers();
    const metrics = makeScoredMetrics();
    mockCompute.computeFormMetrics.mockReturnValue(metrics);

    await processAnalysisJob(makeJob());

    expect(mockLogger.child).toHaveBeenCalledTimes(1);
    expect(mockLogger.child).toHaveBeenCalledWith({
      jobId: "job-1",
      sessionId: 7,
    });
    expect(mockState.getCaptureForJob).toHaveBeenCalledWith(7, 9);
    expect(mockCompute.computeFormMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ frameCount: 2 }),
      "push_up",
    );
    expect(mockState.advanceStage.mock.calls).toEqual([
      [7, "job-1", "ANALYZING_REPS", 0, mockChild],
      [7, "job-1", "ANALYZING_REPS", 1, mockChild],
      [7, "job-1", "WRITING_FEEDBACK", 0, mockChild],
    ]);
    expect(mockBodyMetric.getLatest).toHaveBeenCalledWith(3);
    expect(mockFeedback.generateFormFeedback).toHaveBeenCalledWith({
      metrics,
      context: {
        exerciseDisplayName: "Push-up",
        experienceLevel: "BEGINNER",
        heightCm: 180,
        weightKg: 75,
      },
      signal: expect.any(AbortSignal) as AbortSignal,
      timeoutMs: LLM_TIMEOUT_MS,
      log: mockChild,
    });
    expect(mockResults.saveScored).toHaveBeenCalledWith(
      7,
      "job-1",
      metrics,
      outcome,
    );
    expect(mockState.completeRun).toHaveBeenCalledWith(7, "job-1", mockChild);
    expect(mockChild.info).toHaveBeenCalledWith(
      { outcome: "SCORED", repCount: 5, band: "FAIR" },
      "Form metrics computed",
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("completes an untrackable set without calling the LLM", async () => {
    await withCapture();
    mockCompute.computeFormMetrics.mockReturnValue(untrackable);

    await processAnalysisJob(makeJob());

    expect(mockState.advanceStage.mock.calls.map((call) => call[2])).toEqual([
      "ANALYZING_REPS",
      "ANALYZING_REPS",
    ]);
    expect(mockFeedback.generateFormFeedback).not.toHaveBeenCalled();
    expect(mockBodyMetric.getLatest).not.toHaveBeenCalled();
    expect(mockResults.saveUntrackable).toHaveBeenCalledWith(
      7,
      "job-1",
      untrackable,
    );
    expect(mockState.completeRun).toHaveBeenCalledWith(7, "job-1", mockChild);
  });

  it("does not complete and warns when the scored write was discarded", async () => {
    await withCapture();
    mockResults.saveScored.mockResolvedValue(false);

    await processAnalysisJob(makeJob());

    expect(mockState.completeRun).not.toHaveBeenCalled();
    expect(mockChild.warn).toHaveBeenCalledWith(
      expect.stringContaining("discarded"),
    );
  });

  it("does not complete and warns when the untrackable write was discarded", async () => {
    await withCapture();
    mockCompute.computeFormMetrics.mockReturnValue(untrackable);
    mockResults.saveUntrackable.mockResolvedValue(false);

    await processAnalysisJob(makeJob());

    expect(mockState.completeRun).not.toHaveBeenCalled();
    expect(mockChild.warn).toHaveBeenCalledWith(
      expect.stringContaining("discarded"),
    );
  });

  it("warns when completion itself was discarded", async () => {
    await withCapture();
    mockState.completeRun.mockResolvedValue(false);

    await processAnalysisJob(makeJob());

    expect(mockChild.warn).toHaveBeenCalledWith(
      expect.stringContaining("discarded"),
    );
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

  it("maps UnsupportedCaptureError to CAPTURE_INVALID", async () => {
    await withCapture();
    mockCompute.computeFormMetrics.mockImplementation(() => {
      throw new UnsupportedCaptureError("not blazepose");
    });

    const result = processAnalysisJob(makeJob());

    await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(result).rejects.toThrow("CAPTURE_INVALID");
  });

  it("rethrows unexpected metrics errors so BullMQ retries", async () => {
    await withCapture();
    const boom = new Error("boom");
    mockCompute.computeFormMetrics.mockImplementation(() => {
      throw boom;
    });

    await expect(processAnalysisJob(makeJob())).rejects.toBe(boom);
  });

  it("fails with ANALYSIS_ERROR when the job context is missing", async () => {
    await withCapture();
    mockState.getAnalysisJobContext.mockResolvedValue(null);

    const result = processAnalysisJob(makeJob());

    await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(result).rejects.toThrow("ANALYSIS_ERROR");
  });

  it("fails with ANALYSIS_ERROR for an exercise without form analysis", async () => {
    await withCapture();
    mockState.getAnalysisJobContext.mockResolvedValue({
      userId: 3,
      exerciseCode: "plank",
      exerciseDisplayName: "Plank",
      experienceLevel: "BEGINNER",
    });

    await expect(processAnalysisJob(makeJob())).rejects.toThrow(
      "ANALYSIS_ERROR",
    );
    expect(mockCompute.computeFormMetrics).not.toHaveBeenCalled();
  });

  it("fails with ANALYSIS_ERROR when the user has no body metric", async () => {
    await withCapture();
    mockBodyMetric.getLatest.mockResolvedValue(null);

    const result = processAnalysisJob(makeJob());

    await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(result).rejects.toThrow("ANALYSIS_ERROR");
    expect(mockFeedback.generateFormFeedback).not.toHaveBeenCalled();
  });

  it("fails with ANALYSIS_ERROR when the user has no experience level", async () => {
    await withCapture();
    mockState.getAnalysisJobContext.mockResolvedValue({
      userId: 3,
      exerciseCode: "push_up",
      exerciseDisplayName: "Push-up",
      experienceLevel: null,
    });

    await expect(processAnalysisJob(makeJob())).rejects.toThrow(
      "ANALYSIS_ERROR",
    );
    expect(mockFeedback.generateFormFeedback).not.toHaveBeenCalled();
  });

  it.each(["INVALID_OUTPUT", "REFUSAL"] as const)(
    "turns an LLM %s into an unrecoverable ANALYSIS_ERROR",
    async (code) => {
      await withCapture();
      mockFeedback.generateFormFeedback.mockRejectedValue(new LlmError(code));

      const result = processAnalysisJob(makeJob());

      await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
      await expect(result).rejects.toThrow("ANALYSIS_ERROR");
      expect(mockResults.saveScored).not.toHaveBeenCalled();
    },
  );

  it.each(["TIMEOUT", "RATE_LIMITED", "UNAVAILABLE"] as const)(
    "rethrows an LLM %s unchanged so BullMQ retries",
    async (code) => {
      await withCapture();
      const error = new LlmError(code);
      mockFeedback.generateFormFeedback.mockRejectedValue(error);

      await expect(processAnalysisJob(makeJob())).rejects.toBe(error);
      expect(mockState.completeRun).not.toHaveBeenCalled();
    },
  );

  it("aborts the LLM signal at the deadline and clears the timer on settle", async () => {
    await withCapture();
    let signal: AbortSignal | undefined;
    mockFeedback.generateFormFeedback.mockImplementation(
      (input: { signal: AbortSignal }) => {
        signal = input.signal;
        return new Promise((_resolve, reject) => {
          input.signal.addEventListener("abort", () => {
            reject(new LlmError("TIMEOUT"));
          });
        });
      },
    );
    vi.useFakeTimers();

    const result = processAnalysisJob(makeJob());
    const assertion = expect(result).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    await vi.waitFor(() => expect(signal).toBeDefined());

    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(LLM_TIMEOUT_MS);

    await assertion;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
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
      new LlmError("TIMEOUT"),
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
