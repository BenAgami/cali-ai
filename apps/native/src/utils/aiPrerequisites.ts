import {
  getMissingAiPrerequisites,
  type AiPrerequisiteCode,
  type UserProfile,
} from "@repo/common";

/** Missing AI prerequisites for a profile; empty while it hasn't loaded. */
export const getMissingProfilePrerequisites = (
  profile: UserProfile | undefined,
): AiPrerequisiteCode[] =>
  profile
    ? getMissingAiPrerequisites({
        experienceLevel: profile.experienceLevel,
        hasActiveGoal: profile.goals.length > 0,
        hasBodyMetric: profile.bodyMetric !== null,
        aiConsentVersion: profile.aiConsentVersion,
      })
    : [];
