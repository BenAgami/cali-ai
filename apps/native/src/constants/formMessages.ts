import type { AnalysisFailureReason } from "@repo/common";

export const WHAT_WENT_WELL = "What went well";
export const FIX_THIS = "Fix this";
export const NOT_ASSESSED_TEXT = "Not assessed from this angle";
export const UNTRACKABLE_TITLE = "We couldn't track you clearly";
export const RECORD_AGAIN = "Record again";
export const VIEW_FEEDBACK = "View feedback";
export const ANALYSING_PREFIX = "Analysing...";
export const RECORDED_SETS_TITLE = "Recorded sets";
export const RETRY = "Retry";
export const NEW_BADGE = "New";
export const QUEUED_LABEL = "Queued";
export const UNTRACKABLE_ROW_TEXT = "Couldn't track you";
const FAILURE_FALLBACK_MESSAGE =
  "Something went wrong while analysing this set.";
export const FEEDBACK_NOT_READY_TEXT = "Your feedback is still being prepared.";
export const FEEDBACK_LOAD_ERROR_TEXT = "Couldn't load feedback.";
export const FEEDBACK_SCREEN_TITLE = "Form feedback";
export const MAX_CORRECTIONS_SHOWN = 2;

const ANALYSIS_FAILURE_MESSAGES: Record<AnalysisFailureReason, string> = {
  TIMEOUT: "The analysis took too long.",
  LLM_TIMEOUT: "Writing your feedback took too long.",
  ENQUEUE_FAILED: "We couldn't start the analysis.",
  CAPTURE_MISSING: "The recording couldn't be read.",
  CAPTURE_INVALID: "The recording couldn't be read.",
  ANALYSIS_ERROR: FAILURE_FALLBACK_MESSAGE,
};

// CAPTURE_* failures offer "Record again" instead of a retry.
export const RETRYABLE_FAILURES: ReadonlySet<string> = new Set<string>([
  "TIMEOUT",
  "LLM_TIMEOUT",
  "ENQUEUE_FAILED",
  "ANALYSIS_ERROR",
]);

export const failureMessage = (reason: string | null): string =>
  reason !== null && reason in ANALYSIS_FAILURE_MESSAGES
    ? ANALYSIS_FAILURE_MESSAGES[reason as AnalysisFailureReason]
    : FAILURE_FALLBACK_MESSAGE;

export const repLabel = (repNumbers: number[]): string => {
  if (repNumbers.length === 1) return `Rep ${repNumbers[0]}`;
  const head = repNumbers.slice(0, -1).join(", ");
  return `Reps ${head} and ${repNumbers[repNumbers.length - 1]}`;
};
