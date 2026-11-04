import { z } from "zod";

import { exerciseSummarySchema } from "./exercise";

export const generateWorkoutSchema = z.object({
  goalText: z.string().trim().min(3).max(500),
});

export type GenerateWorkoutValues = z.infer<typeof generateWorkoutSchema>;

export const generatedWorkoutExerciseSchema = z.object({
  exerciseId: z.number().int(),
  sets: z.number().int(),
  reps: z.number().int().nullable(),
  durationSecs: z.number().int().nullable(),
  restSecs: z.number().int(),
  exercise: exerciseSummarySchema,
});

export const workoutGenerationPreviewSchema = z.object({
  generationId: z.number().int(),
  model: z.string(),
  name: z.string(),
  note: z.string().nullable(),
  exercises: z.array(generatedWorkoutExerciseSchema),
});

export type WorkoutGenerationPreview = z.infer<
  typeof workoutGenerationPreviewSchema
>;
