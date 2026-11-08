import { z } from "zod";

import { ANALYSIS_STAGES, SESSION_STATUSES } from "./analysis";
import { ANALYSIS_OUTCOMES } from "./formAnalysis";
import { EXERCISE_TYPES } from "./exercise";
import { paginatedSchema } from "./pagination";

const exerciseCodeSchema = z.string().trim().min(1).max(40);

export const createWorkoutSessionSchema = z
  .object({
    exerciseCode: exerciseCodeSchema,
    notes: z.string().trim().max(2000).optional(),
    performedAt: z.iso.datetime().optional(),
    workoutId: z.number().int().positive().optional(),
    setNumber: z.number().int().min(1).max(50).optional(),
  })
  .refine(
    (value) => value.setNumber === undefined || value.workoutId !== undefined,
    {
      message: "setNumber requires workoutId",
      path: ["setNumber"],
    },
  );

export type CreateWorkoutSessionValues = z.infer<
  typeof createWorkoutSessionSchema
>;

export const workoutSessionResponseSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  exerciseId: z.number().int(),
  processingStatus: z.enum(SESSION_STATUSES),
  workoutId: z.number().int().nullable(),
  setNumber: z.number().int().nullable(),
  notes: z.string().nullable(),
  performedAt: z.string(),
  processingStartedAt: z.string().nullable(),
  processingFinishedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  analysisStage: z.enum(ANALYSIS_STAGES).nullable(),
  analysisStageProgress: z.number().nullable(),
  bullmqJobId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  exercise: z.object({
    code: z.string(),
    displayName: z.string(),
    exerciseType: z.enum(EXERCISE_TYPES),
  }),
});

export type WorkoutSessionResponse = z.infer<
  typeof workoutSessionResponseSchema
>;

export const workoutSessionListItemSchema = workoutSessionResponseSchema.extend(
  {
    analysisResult: z
      .object({
        outcome: z.enum(ANALYSIS_OUTCOMES),
        analyzedAt: z.string(),
        summaryFeedback: z.string().nullable(),
      })
      .nullable(),
  },
);

export type WorkoutSessionListItem = z.infer<
  typeof workoutSessionListItemSchema
>;

export const workoutSessionListResponseSchema = paginatedSchema(
  workoutSessionListItemSchema,
);

export type WorkoutSessionListResponse = z.infer<
  typeof workoutSessionListResponseSchema
>;
