import { z } from "zod";

const exerciseCodeSchema = z.string().trim().min(1).max(40);

export const createWorkoutSessionSchema = z.object({
  exerciseCode: exerciseCodeSchema,
  notes: z.string().trim().max(2000).optional(),
  performedAt: z.iso.datetime().optional(),
});

export type CreateWorkoutSessionValues = z.infer<
  typeof createWorkoutSessionSchema
>;
