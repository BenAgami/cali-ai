import { z } from "zod";

const exerciseCodeSchema = z.string().trim().min(1).max(40);

const videoMetaSchema = z
  .object({
    durationSec: z.number().positive().max(60),
    fps: z.number().positive().max(240),
    width: z.number().int().positive().max(7680),
    height: z.number().int().positive().max(7680),
    sizeBytes: z.number().int().positive().max(250_000_000),
  })
  .partial();

export const createWorkoutSessionSchema = z.object({
  exerciseCode: exerciseCodeSchema,
  notes: z.string().trim().max(2000).optional(),
  performedAt: z.iso.datetime().optional(),
  videoMeta: videoMetaSchema.optional(),
});

export type CreateWorkoutSessionValues = z.infer<
  typeof createWorkoutSessionSchema
>;
