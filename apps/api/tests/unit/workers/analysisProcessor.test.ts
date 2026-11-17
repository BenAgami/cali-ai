import { UnrecoverableError } from "bullmq";
import type { PoseCapturePayload } from "@repo/common";

import { PreconditionRequiredError } from "../../../src/errors";
import { LlmError } from "../../../src/lib/llm/types";
import { UnsupportedCaptureError } from "../../../src/metrics/preprocess";
import { METRICS_VERSION } from "../../../src/metrics/types";
import { FORM_FEEDBACK_PROMPT_VERSION } from "../../../src/prompts/formFeedbackPrompt";
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
  completeRunWithResult: vi.fn(),
  failRun: vi.fn(),
}));
const mockFeedback = vi.hoisted(() => ({ generateFormFeedback: vi.fn() }));
const mockResults = vi.hoisted(() => ({
  saveScored: vi.fn(),
  saveUntrackable: vi.fn(),
}));
const mockPrerequisites = vi.hoisted(() => ({
  assertAiPrerequisites: vi.fn(),
}));
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
vi.mock("../../../src/services/aiPrerequisitesService", () => ({
  default: mockPrerequisites,
}));
vi.mock("../../../src/metrics/computeFormMetrics", () => mockCompute);
vi.mock("../../../src/lib/logger", () => ({ logger: mockLogger }));

import {
  onAnalysisJobFailed,
  processAnalysisJob,
} from "../../../src/workers/analysisProcessor";

const fakeTx = { marker: "tx" };

type JobData = { recordedSetId: number; captureId: number };

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
  promptVersion: FORM_FEEDBACK_PROMPT_VERSION,
  usage: { inputTokens: 1, outputTokens: 1 },
  attempts: 1,
};

const untrackable = {
  outcome: "UNTRACKABLE" as const,
  exerciseCode: "push_up" as const,
  reasons: ["NO_REPS_DETECTED" as const],
  metricsVersion: METRICS_VERSION,
  rubricVersion: "rubric-v0",
};

const makeJob = (extra: { attemptsMade?: number; attempts?: number } = {}) =>
  createFakeJob<JobData>({
    id: "job-1",
    data: { recordedSetId: 7, captureId: 9 },
    ...extra,
  });

beforeEach(() => {
  vi.resetAllMocks();
  mockLogger.child.mockReturnValue(mockChild);
  mockState.advanceStage.mockResolvedValue(true);
  mockState.completeRunWithResult.mockImplementation(
    async (
      _recordedSetId: number,
      _jobId: string,
      write: (tx: unknown) => Promise<void>,
    ) => {
      await write(fakeTx);
      return true;
    },
  );
  mockState.failRun.mockResolvedValue(true);
  mockState.getAnalysisJobContext.mockResolvedValue({
    userId: 3,
    exerciseCode: "push_up",
    exerciseDisplayName: "Push-up",
  });
  mockPrerequisites.assertAiPrerequisites.mockResolvedValue({
    userId: 3,
    experienceLevel: "BEGINNER",
    goal: { goalType: "STRENGTH", title: "First pull-up" },
    heightCm: 180,
    weightKg: 75,
  });
  mockCompute.computeFormMetrics.mockReturnValue(makeScoredMetrics());
  mockFeedback.generateFormFeedback.mockResolvedValue(outcome);
  mockResults.saveScored.mockResolvedValue(true);
  mockResults.saveUntrackable.mockResolvedValue(true);
});

describe("processAnalysisJob", () => {
  const withCapture = async () =>
    mockState.getCaptureForJob.mockResolvedValue({
      id: 9,
      keypoints: await encodeCapture(payload()),
      keypointsFormat: KEYPOINTS_FORMAT,
    });

  it("scores the set: stages, LLM call with context and log only, save, complete", async () => {
    await withCapture();
    const metrics = makeScoredMetrics();
    mockCompute.computeFormMetrics.mockReturnValue(metrics);

    await processAnalysisJob(makeJob());

    expect(mockLogger.child).toHaveBeenCalledTimes(1);
    expect(mockLogger.child).toHaveBeenCalledWith({
      jobId: "job-1",
      recordedSetId: 7,
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
    expect(mockPrerequisites.assertAiPrerequisites).toHaveBeenCalledWith(3);
    expect(mockFeedback.generateFormFeedback).toHaveBeenCalledWith({
      metrics,
      context: {
        exerciseDisplayName: "Push-up",
        experienceLevel: "BEGINNER",
        heightCm: 180,
        weightKg: 75,
      },
      log: mockChild,
    });
    expect(mockState.completeRunWithResult).toHaveBeenCalledTimes(1);
    expect(mockState.completeRunWithResult).toHaveBeenCalledWith(
      7,
      "job-1",
      expect.any(Function),
      mockChild,
    );
    expect(mockResults.saveScored).toHaveBeenCalledWith(
      fakeTx,
      7,
      metrics,
      outcome,
    );
    expect(mockChild.info).toHaveBeenCalledWith(
      { outcome: "SCORED", repCount: 5, band: "FAIR" },
      "Form metrics computed",
    );
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
    expect(mockPrerequisites.assertAiPrerequisites).not.toHaveBeenCalled();
    expect(mockState.completeRunWithResult).toHaveBeenCalledTimes(1);
    expect(mockResults.saveUntrackable).toHaveBeenCalledWith(
      fakeTx,
      7,
      untrackable,
    );
  });

  it("skips the LLM call and save when a newer run replaced this job", async () => {
    await withCapture();
    mockState.advanceStage.mockImplementation(
      (_recordedSetId: number, _jobId: string, stage: string) =>
        Promise.resolve(stage !== "WRITING_FEEDBACK"),
    );

    await processAnalysisJob(makeJob());

    expect(mockFeedback.generateFormFeedback).not.toHaveBeenCalled();
    expect(mockResults.saveScored).not.toHaveBeenCalled();
    expect(mockState.completeRunWithResult).not.toHaveBeenCalled();
    expect(mockChild.warn).toHaveBeenCalledWith(
      expect.stringContaining("skipping"),
    );
  });

  it.each(["scored", "untrackable"] as const)(
    "warns when the %s result was discarded because the run changed",
    async (kind) => {
      await withCapture();
      if (kind === "untrackable") {
        mockCompute.computeFormMetrics.mockReturnValue(untrackable);
      }
      mockState.completeRunWithResult.mockResolvedValue(false);

      await processAnalysisJob(makeJob());

      expect(mockChild.warn).toHaveBeenCalledWith(
        expect.stringContaining("discarded"),
      );
    },
  );

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
    });

    await expect(processAnalysisJob(makeJob())).rejects.toThrow(
      "ANALYSIS_ERROR",
    );
    expect(mockCompute.computeFormMetrics).not.toHaveBeenCalled();
  });

  it("abandons the job with ANALYSIS_ERROR and no LLM call when AI prerequisites lapsed", async () => {
    await withCapture();
    mockPrerequisites.assertAiPrerequisites.mockRejectedValue(
      new PreconditionRequiredError("Consent needed", "AI_CONSENT_REQUIRED"),
    );

    const result = processAnalysisJob(makeJob());

    await expect(result).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(result).rejects.toThrow("ANALYSIS_ERROR");
    expect(mockFeedback.generateFormFeedback).not.toHaveBeenCalled();
  });

  it("rethrows an unexpected prerequisites error so BullMQ retries it", async () => {
    await withCapture();
    const boom = new Error("db down");
    mockPrerequisites.assertAiPrerequisites.mockRejectedValue(boom);

    await expect(processAnalysisJob(makeJob())).rejects.toBe(boom);
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
      expect(mockState.completeRunWithResult).not.toHaveBeenCalled();
    },
  );
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
