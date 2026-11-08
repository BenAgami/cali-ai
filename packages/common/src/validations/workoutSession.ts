import { z } from "zod";

import { ANALYSIS_STAGES } from "./analysis";
import { EXERCISE_TYPES } from "./exercise";

const exerciseCodeSchema = z.string().trim().min(1).max(40);

export const createWorkoutSessionSchema = z.object({
  exerciseCode: exerciseCodeSchema,
  notes: z.string().trim().max(2000).optional(),
  performedAt: z.iso.datetime().optional(),
});

export type CreateWorkoutSessionValues = z.infer<
  typeof createWorkoutSessionSchema
>;

const SESSION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;

export const workoutSessionResponseSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  exerciseId: z.number().int(),
  processingStatus: z.enum(SESSION_STATUSES),
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
