export type LlmErrorCode =
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "INVALID_OUTPUT"
  | "REFUSAL"
  | "UNAVAILABLE";

export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string = code,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "LlmError";
  }
}

export type LlmEffort = "low" | "medium" | "high";

export type WorkoutPlanDraftExercise = {
  exerciseCode: string;
  sets: number;
  reps: number | null;
  durationSecs: number | null;
  restSecs: number;
};

export type WorkoutPlanDraft = {
  name: string;
  note: string | null;
  exercises: WorkoutPlanDraftExercise[];
};

export type WorkoutPlanRequest = {
  model: string;
  effort: LlmEffort;
  maxTokens: number;
  timeoutMs: number;
  signal: AbortSignal;
  system: string;
  user: string;
  exerciseCodes: [string, ...string[]];
};

export type WorkoutPlanResult = {
  plan: WorkoutPlanDraft;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
};

export interface LlmProvider {
  generateWorkoutPlan(request: WorkoutPlanRequest): Promise<WorkoutPlanResult>;
}
