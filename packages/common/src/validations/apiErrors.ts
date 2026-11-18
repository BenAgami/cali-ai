/** Machine-readable `code` values on API errors that clients branch on. */
export const API_ERROR_CODES = {
  ANALYSIS_FAILED: "ANALYSIS_FAILED",
  DAILY_ANALYSIS_LIMIT_REACHED: "DAILY_ANALYSIS_LIMIT_REACHED",
  DAILY_RETRY_LIMIT_REACHED: "DAILY_RETRY_LIMIT_REACHED",
  WORKOUT_LOG_COMPLETED: "WORKOUT_LOG_COMPLETED",
} as const;

/** The analysis caps' user-facing text, sent by the API and shown by the app. */
export const ANALYSIS_LIMIT_MESSAGES = {
  dailyAnalysis:
    "You've reached today's limit for form analysis. Try again tomorrow.",
  dailyRetry:
    "You've reached today's limit for analysis retries. Try again tomorrow.",
} as const;
