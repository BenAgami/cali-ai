import { z } from "zod";

export const ANALYSIS_STAGES = [
  "QUEUED",
  "ANALYZING_REPS",
  "WRITING_FEEDBACK",
  "COMPLETED",
] as const;
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

const ANALYSIS_EVENT_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;

export const analysisStatusEventSchema = z.object({
  sessionId: z.number().int().positive(),
  status: z.enum(ANALYSIS_EVENT_STATUSES),
  stage: z.enum(ANALYSIS_STAGES),
  stage_label: z.string().min(1),
  progress_percent: z.number().int().min(0).max(100),
  failure_reason: z.string().nullable(),
});
export type AnalysisStatusEvent = z.infer<typeof analysisStatusEventSchema>;

export const ANALYSIS_FAILURE_REASONS = [
  "TIMEOUT",
  "ENQUEUE_FAILED",
  "CAPTURE_MISSING",
  "CAPTURE_INVALID",
  "LLM_TIMEOUT",
  "ANALYSIS_ERROR",
] as const;
export type AnalysisFailureReason = (typeof ANALYSIS_FAILURE_REASONS)[number];
