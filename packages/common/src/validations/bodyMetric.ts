import { z } from "zod";

export const bodyMetricInputSchema = z.object({
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
});

export type BodyMetricInput = z.infer<typeof bodyMetricInputSchema>;

export const bodyMetricSchema = z.object({
  heightCm: z.number(),
  weightKg: z.number(),
  createdAt: z.string(),
});

export type BodyMetric = z.infer<typeof bodyMetricSchema>;

export const saveBodyMetricResponseSchema = z.object({
  bodyMetric: bodyMetricSchema,
  created: z.boolean(),
});

export type SaveBodyMetricResponse = z.infer<
  typeof saveBodyMetricResponseSchema
>;
