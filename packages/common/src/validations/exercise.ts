import { z } from "zod";

import { paginatedSchema } from "./pagination";

export const EXERCISE_TYPES = ["DYNAMIC", "STATIC_HOLD"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const exerciseSummarySchema = z.object({
  id: z.number().int(),
  code: z.string(),
  displayName: z.string(),
  exerciseType: z.enum(EXERCISE_TYPES),
});
export type ExerciseSummary = z.infer<typeof exerciseSummarySchema>;

export const exerciseDetailSchema = exerciseSummarySchema.extend({
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ExerciseDetail = z.infer<typeof exerciseDetailSchema>;

export const exerciseListResponseSchema = paginatedSchema(
  exerciseSummarySchema,
);
export type ExerciseListResponse = z.infer<typeof exerciseListResponseSchema>;
