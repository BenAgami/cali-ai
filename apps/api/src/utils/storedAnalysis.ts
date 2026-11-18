import { z } from "zod";

const storedDimensionSchema = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  isAssessed: z.boolean(),
});

/** Shape of `AnalysisResult.scoreBreakdown` for SCORED results. */
export const storedScoreBreakdownSchema = z.object({
  ROM: storedDimensionSchema,
  CORE: storedDimensionSchema,
  SYMMETRY: storedDimensionSchema,
});

/** Shape of `AnalysisResult.rawFeedback` for SCORED results. */
export const storedRawFeedbackSchema = z.object({
  metricsVersion: z.string(),
  rubricVersion: z.string(),
  promptVersion: z.string().nullable(),
  repCount: z.number().int().min(0),
  droppedRepCount: z.number().int().min(0),
  reps: z.array(z.unknown()),
  llmUsage: z
    .object({
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
    })
    .nullable(),
});
