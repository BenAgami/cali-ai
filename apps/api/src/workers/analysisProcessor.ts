import { UnrecoverableError, type Job } from "bullmq";
import {
  ANALYSIS_FAILURE_REASONS,
  isFormAnalysisExercise,
  type AnalysisFailureReason,
  type PoseCapturePayload,
} from "@repo/common";

import { env } from "../config/env";
import { LlmError } from "../lib/llm";
import { logger } from "../lib/logger";
import type { AnalysisJobData } from "../lib/queue";
import { computeFormMetrics } from "../metrics/computeFormMetrics";
import { UnsupportedCaptureError } from "../metrics/preprocess";
import analysisStateService from "../services/analysisStateService";
import bodyMetricService from "../services/bodyMetricService";
import feedbackService, {
  type FormFeedbackOutcome,
} from "../services/feedbackService";
import formAnalysisResultService from "../services/formAnalysisResultService";
import { decodeCapture, InvalidCaptureError } from "../utils/captureCodec";

const isFailureReason = (value: string): value is AnalysisFailureReason =>
  (ANALYSIS_FAILURE_REASONS as readonly string[]).includes(value);

const toFailureReason = (error: Error): AnalysisFailureReason => {
  if (error instanceof UnrecoverableError && isFailureReason(error.message)) {
    return error.message;
  }
  if (error instanceof LlmError && error.code === "TIMEOUT") {
    return "LLM_TIMEOUT";
  }
  return "ANALYSIS_ERROR";
};

/**
 * Unusable model output is permanent (the in-attempt repair already ran);
 * timeouts, rate limits and outages are rethrown so BullMQ retries them.
 */
const toProcessingError = (error: unknown): unknown => {
  if (
    error instanceof LlmError &&
    (error.code === "INVALID_OUTPUT" || error.code === "REFUSAL")
  ) {
    return new UnrecoverableError("ANALYSIS_ERROR");
  }
  return error;
};

export const processAnalysisJob = async (
  job: Job<AnalysisJobData>,
): Promise<void> => {
  const { sessionId, captureId } = job.data;
  const jobId = job.id ?? "";
  const log = logger.child({ jobId, sessionId });

  const capture = await analysisStateService.getCaptureForJob(
    sessionId,
    captureId,
  );
  if (!capture?.keypoints) {
    throw new UnrecoverableError("CAPTURE_MISSING");
  }

  const jobContext =
    await analysisStateService.getAnalysisJobContext(sessionId);
  if (!jobContext || !isFormAnalysisExercise(jobContext.exerciseCode)) {
    throw new UnrecoverableError("ANALYSIS_ERROR");
  }
  const { exerciseCode } = jobContext;

  await analysisStateService.advanceStage(
    sessionId,
    jobId,
    "ANALYZING_REPS",
    0,
    log,
  );

  let payload: PoseCapturePayload;
  try {
    payload = await decodeCapture(capture.keypoints);
  } catch (error) {
    if (error instanceof InvalidCaptureError) {
      throw new UnrecoverableError("CAPTURE_INVALID");
    }
    throw error;
  }

  let metrics: ReturnType<typeof computeFormMetrics>;
  try {
    metrics = computeFormMetrics(payload, exerciseCode);
  } catch (error) {
    if (error instanceof UnsupportedCaptureError) {
      throw new UnrecoverableError("CAPTURE_INVALID");
    }
    throw error;
  }

  await analysisStateService.advanceStage(
    sessionId,
    jobId,
    "ANALYZING_REPS",
    1,
    log,
  );

  if (metrics.outcome === "UNTRACKABLE") {
    log.info(
      { outcome: metrics.outcome, reasons: metrics.reasons },
      "Form metrics computed",
    );

    const isSaved = await formAnalysisResultService.saveUntrackable(
      sessionId,
      jobId,
      metrics,
    );
    const isCompleted =
      isSaved &&
      (await analysisStateService.completeRun(sessionId, jobId, log));
    if (!isCompleted) {
      log.warn("Run state changed during processing; result discarded");
    }
    return;
  }

  log.info(
    {
      outcome: metrics.outcome,
      repCount: metrics.repCount,
      band: metrics.band,
    },
    "Form metrics computed",
  );

  await analysisStateService.advanceStage(
    sessionId,
    jobId,
    "WRITING_FEEDBACK",
    0,
    log,
  );

  const bodyMetric = await bodyMetricService.getLatest(jobContext.userId);
  if (!bodyMetric || !jobContext.experienceLevel) {
    throw new UnrecoverableError("ANALYSIS_ERROR");
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => {
    controller.abort();
  }, env.analysis.llmTimeoutMs);

  let outcome: FormFeedbackOutcome;
  try {
    outcome = await feedbackService.generateFormFeedback({
      metrics,
      context: {
        exerciseDisplayName: jobContext.exerciseDisplayName,
        experienceLevel: jobContext.experienceLevel,
        heightCm: bodyMetric.heightCm,
        weightKg: bodyMetric.weightKg,
      },
      signal: controller.signal,
      timeoutMs: env.analysis.llmTimeoutMs,
      log,
    });
  } catch (error) {
    throw toProcessingError(error);
  } finally {
    clearTimeout(deadline);
  }

  const isSaved = await formAnalysisResultService.saveScored(
    sessionId,
    jobId,
    metrics,
    outcome,
  );
  const isCompleted =
    isSaved && (await analysisStateService.completeRun(sessionId, jobId, log));
  if (!isCompleted) {
    log.warn("Run state changed during processing; result discarded");
  }
};

export const onAnalysisJobFailed = async (
  job: Job<AnalysisJobData> | undefined,
  error: Error,
): Promise<void> => {
  if (!job) return;

  const jobId = job.id ?? "";
  const log = logger.child({ jobId, sessionId: job.data.sessionId });

  const isFinal =
    error instanceof UnrecoverableError ||
    job.attemptsMade >= (job.opts.attempts ?? 1);

  if (!isFinal) {
    log.warn(
      { err: error, attempt: job.attemptsMade },
      "Analysis attempt failed; retrying",
    );
    return;
  }

  log.error({ err: error }, "Analysis job failed permanently");
  await analysisStateService.failRun(
    job.data.sessionId,
    jobId,
    toFailureReason(error),
    log,
  );
};
