import { z } from "zod";

import type { ExperienceLevel } from "./user";

export const AI_CONSENT_VERSION = "2026-11-08";

export const aiConsentSchema = z.object({
  version: z.literal(AI_CONSENT_VERSION),
});

export type AiConsentValues = z.infer<typeof aiConsentSchema>;

export const AI_PREREQUISITE_CODES = [
  "PROFILE_INCOMPLETE",
  "BODY_METRICS_REQUIRED",
  "AI_CONSENT_REQUIRED",
] as const;

export type AiPrerequisiteCode = (typeof AI_PREREQUISITE_CODES)[number];

export type AiPrerequisiteInput = {
  experienceLevel: ExperienceLevel | null;
  hasActiveGoal: boolean;
  hasBodyMetric: boolean;
  aiConsentVersion: string | null;
};

export const getMissingAiPrerequisites = (
  input: AiPrerequisiteInput,
): AiPrerequisiteCode[] => {
  const missing: AiPrerequisiteCode[] = [];
  if (input.experienceLevel === null || !input.hasActiveGoal) {
    missing.push("PROFILE_INCOMPLETE");
  }
  if (!input.hasBodyMetric) missing.push("BODY_METRICS_REQUIRED");
  if (input.aiConsentVersion !== AI_CONSENT_VERSION) {
    missing.push("AI_CONSENT_REQUIRED");
  }
  return missing;
};
