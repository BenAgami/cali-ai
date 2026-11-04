export const AI_DISCLAIMER_TEXT =
  "AI-generated plan. This is not medical advice: check that each exercise suits you, stop if you feel pain, and talk to a professional if you have an injury or health condition.";

export const AI_GOAL_EXAMPLES = [
  "Build upper-body strength",
  "Get my first pull-up",
  "20-minute full-body routine",
  "Improve push-up endurance",
  "Learn to hold a handstand",
] as const;

export const AI_ERROR_MESSAGES: Record<string, string> = {
  DAILY_LIMIT_REACHED:
    "You've reached today's limit for AI workouts. Try again tomorrow.",
  GENERATION_IN_PROGRESS:
    "A workout is already being generated. Please wait a moment.",
  GENERATION_FAILED: "We couldn't generate a workout. Please try again.",
  LLM_RATE_LIMITED:
    "The AI service is busy. Please try again in a few minutes.",
  LLM_UNAVAILABLE:
    "The AI service is unavailable right now. Please try again later.",
  CATALOG_EMPTY: "No exercises are available yet. Please try again later.",
};

export const AI_ERROR_FALLBACK = "Something went wrong. Please try again.";
export const AI_GENERATING_TEXT =
  "Building your workout. This can take up to a minute.";
export const AI_ALREADY_SAVED_TEXT = "This plan is already saved.";
