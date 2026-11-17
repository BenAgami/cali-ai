import { z } from "zod";

import { exerciseSummarySchema } from "./exercise";
import { paginatedSchema } from "./pagination";

const workoutExerciseInputSchema = z.object({
  exerciseId: z.number().int().positive(),
  sets: z.number().int().min(1).max(99),
  reps: z.number().int().min(1).max(999).nullable().optional(),
  durationSecs: z.number().int().min(1).max(3600).nullable().optional(),
  restSecs: z.number().int().min(0).max(600),
});
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseInputSchema>;

export const createWorkoutSchema = z.object({
  name: z.string().trim().min(1).max(100),
  exercises: z.array(workoutExerciseInputSchema).min(1).max(50),
  generationId: z.number().int().positive().optional(),
});
export type CreateWorkoutValues = z.infer<typeof createWorkoutSchema>;

export const updateWorkoutSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  exercises: z.array(workoutExerciseInputSchema).min(1).max(50).optional(),
});
export type UpdateWorkoutValues = z.infer<typeof updateWorkoutSchema>;

const DEFAULT_RECORDED_SETS_LIMIT = 50;
const MAX_RECORDED_SETS_LIMIT = 100;

export const workoutIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const workoutRunIdParamSchema = workoutIdParamSchema.extend({
  runId: z.coerce.number().int().positive(),
});

export const recordedSetsQuerySchema = z.object({
  workoutRunId: z.coerce.number().int().positive().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_RECORDED_SETS_LIMIT)
    .default(DEFAULT_RECORDED_SETS_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});
export type RecordedSetsQuery = z.infer<typeof recordedSetsQuerySchema>;

// ── Responses ──────────────────────────────────────────────────────────────

export const workoutExerciseHydratedSchema = z.object({
  id: z.number().int(),
  workoutId: z.number().int(),
  exerciseId: z.number().int(),
  position: z.number().int(),
  sets: z.number().int(),
  reps: z.number().int().nullable(),
  durationSecs: z.number().int().nullable(),
  restSecs: z.number().int(),
  createdAt: z.string(),
  exercise: exerciseSummarySchema,
});

export type WorkoutExerciseHydrated = z.infer<
  typeof workoutExerciseHydratedSchema
>;

export const workoutWithExercisesSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  aiModel: z.string().nullable(),
  generationId: z.number().int().nullable(),
  exercises: z.array(workoutExerciseHydratedSchema),
});
export type WorkoutWithExercises = z.infer<typeof workoutWithExercisesSchema>;

export const workoutListResponseSchema = paginatedSchema(
  workoutWithExercisesSchema,
);
export type WorkoutListResponse = z.infer<typeof workoutListResponseSchema>;

export const workoutRunResponseSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  workoutId: z.number().int().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  durationSecs: z.number().int().nullable(),
  createdAt: z.string(),
});
export type WorkoutRunResponse = z.infer<typeof workoutRunResponseSchema>;
