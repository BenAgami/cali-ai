import { UnrecoverableError, type Job } from "bullmq";
import {
  ANALYSIS_FAILURE_REASONS,
  type AnalysisFailureReason,
  type PoseCapturePayload,
} from "@repo/common";

import { env } from "../config/env";
import { logger } from "../lib/logger";
import type { AnalysisJobData } from "../lib/queue";
import analysisStateService from "../services/analysisStateService";
import feedbackService, {
  type FeedbackInput,
} from "../services/feedbackService";
import { decodeCapture, InvalidCaptureError } from "../utils/captureCodec";
import { TimeoutError, withTimeout } from "../utils/withTimeout";

// Metrics stub: Phase 5 replaces this with real rep/form metrics.
const summarizeCapture = (payload: PoseCapturePayload): FeedbackInput => {
  let total = 0;
  let count = 0;
  for (const frame of payload.frames) {
    for (const keypoint of frame.keypoints) {
      total += keypoint[2];
      count += 1;
    }
  }
  return {
    frameCount: payload.frames.length,
    keypointsPerFrame: payload.frames[0]?.keypoints.length ?? 0,
    meanConfidence: count === 0 ? 0 : total / count,
  };
};

const isFailureReason = (value: string): value is AnalysisFailureReason =>
  (ANALYSIS_FAILURE_REASONS as readonly string[]).includes(value);

const toFailureReason = (error: Error): AnalysisFailureReason => {
  if (error instanceof UnrecoverableError && isFailureReason(error.message)) {
    return error.message;
  }
  if (error instanceof TimeoutError && error.code === "LLM_TIMEOUT") {
    return "LLM_TIMEOUT";
  }
  return "ANALYSIS_ERROR";
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

  await analysisStateService.advanceStage(
    sessionId,
    jobId,
    "ANALYZING_REPS",
    1,
    log,
  );
  await analysisStateService.advanceStage(
    sessionId,
    jobId,
    "WRITING_FEEDBACK",
    0,
    log,
  );

  await withTimeout(
    feedbackService.generateFeedback(summarizeCapture(payload)),
    env.analysis.llmTimeoutMs,
    "LLM_TIMEOUT",
  );

  const completed = await analysisStateService.completeRun(
    sessionId,
    jobId,
    log,
  );
  if (!completed) {
    log.warn("Run state changed during processing; completion discarded");
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
