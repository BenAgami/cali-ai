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

export const createWorkoutSchema = z.object({
  name: z.string().trim().min(1).max(100),
  exercises: z.array(workoutExerciseInputSchema).min(1).max(50),
  generationId: z.number().int().positive().optional(),
});

export const updateWorkoutSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  exercises: z.array(workoutExerciseInputSchema).min(1).max(50).optional(),
});

export const workoutLogSchema = z.object({
  durationSecs: z.number().int().min(0).max(86_400),
  completedAt: z.iso.datetime().optional(),
});

export type CreateWorkoutValues = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutValues = z.infer<typeof updateWorkoutSchema>;
export type WorkoutLogValues = z.infer<typeof workoutLogSchema>;
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseInputSchema>;

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

export const workoutLogResponseSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  workoutId: z.number().int(),
  durationSecs: z.number().int(),
  completedAt: z.string(),
  createdAt: z.string(),
});

export type WorkoutLogResponse = z.infer<typeof workoutLogResponseSchema>;
