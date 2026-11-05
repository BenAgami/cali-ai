import {
  createWorkoutSchema,
  type ExerciseSummary,
  type ExperienceLevel,
} from "@repo/common";

import type { WorkoutPlanDraft } from "../lib/llm";

export type ValidatedPlan = {
  name: string;
  note: string | null;
  exercises: Array<{
    exerciseId: number;
    sets: number;
    reps: number | null;
    durationSecs: number | null;
    restSecs: number;
    exercise: ExerciseSummary;
  }>;
};

export type PlanValidationResult =
  | { ok: true; plan: ValidatedPlan }
  | { ok: false; issues: string[] };

const MIN_EXERCISES = 3;
const MAX_EXERCISES = 6;
const MAX_NAME_LENGTH = 100;
const MAX_NOTE_LENGTH = 300;

// The structured-output API ignores min/max, so ranges are enforced here.
const SETS = { min: 1, max: 6 };
const REPS = { min: 1, max: 30 };
const DURATION = { min: 5, max: 120 };
const REST = { min: 30, max: 300 };
const BEGINNER = { maxSets: 4, maxReps: 15 };

const isOutsideRange = (value: number, range: { min: number; max: number }) =>
  !Number.isInteger(value) || value < range.min || value > range.max;

/**
 * Checks an LLM draft against the active catalog and code-side safety bounds.
 * Collects every issue so a retry gets complete feedback.
 */
export const validateGeneratedPlan = (
  draft: WorkoutPlanDraft,
  catalog: ReadonlyMap<string, ExerciseSummary>,
  level: ExperienceLevel,
): PlanValidationResult => {
  const issues: string[] = [];

  const name = draft.name.trim().slice(0, MAX_NAME_LENGTH).trim();
  if (name.length === 0) issues.push("Plan name is empty");

  const note = draft.note
    ? draft.note.trim().slice(0, MAX_NOTE_LENGTH) || null
    : null;

  if (
    draft.exercises.length < MIN_EXERCISES ||
    draft.exercises.length > MAX_EXERCISES
  ) {
    issues.push(
      `Plan must have ${MIN_EXERCISES} to ${MAX_EXERCISES} exercises`,
    );
  }

  const exercises: ValidatedPlan["exercises"] = [];

  for (const item of draft.exercises) {
    const code = item.exerciseCode.trim().toLowerCase();
    const exercise = catalog.get(code);
    if (!exercise) {
      issues.push(`Unknown exercise code: ${item.exerciseCode.trim()}`);
      continue;
    }

    const before = issues.length;

    if (exercise.exerciseType === "DYNAMIC") {
      if (item.reps === null || item.durationSecs !== null) {
        issues.push(
          `${code} is DYNAMIC: set reps and set durationSecs to null`,
        );
      } else if (isOutsideRange(item.reps, REPS)) {
        issues.push(
          `${code}: reps must be ${REPS.min}-${REPS.max}, got ${item.reps}`,
        );
      } else if (level === "BEGINNER" && item.reps > BEGINNER.maxReps) {
        issues.push(
          `${code}: reps must be at most ${BEGINNER.maxReps} for a beginner, got ${item.reps}`,
        );
      }
    } else if (item.durationSecs === null || item.reps !== null) {
      issues.push(
        `${code} is STATIC_HOLD: set durationSecs and set reps to null`,
      );
    } else if (isOutsideRange(item.durationSecs, DURATION)) {
      issues.push(
        `${code}: durationSecs must be ${DURATION.min}-${DURATION.max}, got ${item.durationSecs}`,
      );
    }

    if (isOutsideRange(item.sets, SETS)) {
      issues.push(
        `${code}: sets must be ${SETS.min}-${SETS.max}, got ${item.sets}`,
      );
    } else if (level === "BEGINNER" && item.sets > BEGINNER.maxSets) {
      issues.push(
        `${code}: sets must be at most ${BEGINNER.maxSets} for a beginner, got ${item.sets}`,
      );
    }

    if (isOutsideRange(item.restSecs, REST)) {
      issues.push(
        `${code}: restSecs must be ${REST.min}-${REST.max}, got ${item.restSecs}`,
      );
    }

    if (issues.length === before) {
      exercises.push({
        exerciseId: exercise.id,
        sets: item.sets,
        reps: item.reps,
        durationSecs: item.durationSecs,
        restSecs: item.restSecs,
        exercise,
      });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  const parsed = createWorkoutSchema.safeParse({
    name,
    exercises: exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets,
      reps: e.reps,
      durationSecs: e.durationSecs,
      restSecs: e.restSecs,
    })),
  });
  if (!parsed.success) {
    return { ok: false, issues: ["Plan does not fit the workout schema"] };
  }

  return { ok: true, plan: { name, note, exercises } };
};
