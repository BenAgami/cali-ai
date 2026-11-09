import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { userApi, userKeys } from "@src/api";
import { useProfile } from "@src/hooks/queries/useProfile";
import { useAcceptAiConsent } from "@src/hooks/mutations/useAcceptAiConsent";
import { useSaveBodyMetrics } from "@src/hooks/mutations/useSaveBodyMetrics";
import { useBodyMetricsForm } from "@src/hooks/useBodyMetricsForm";
import { AI_ERROR_FALLBACK } from "@src/constants/aiMessages";
import {
  getMissingAiPrerequisites,
  type AiPrerequisiteCode,
  type ExperienceLevel,
  type GoalType,
} from "@repo/common";

export type AiPrerequisiteStep = AiPrerequisiteCode | "READY";

const PROFILE_ERROR = "Choose a level and enter a goal.";

/**
 * Profile, body-metrics and consent prerequisites for AI features. Shared by
 * Generate with AI and the recording screen.
 */
export const useAiPrerequisiteSteps = () => {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, refetch } = useProfile();

  const missing: AiPrerequisiteCode[] = profile
    ? getMissingAiPrerequisites({
        experienceLevel: profile.experienceLevel,
        hasActiveGoal: profile.goals.length > 0,
        hasBodyMetric: profile.bodyMetric !== null,
        aiConsentVersion: profile.aiConsentVersion,
      })
    : [];
  const step: AiPrerequisiteStep = missing.at(0) ?? "READY";

  const [levelDraft, setLevelDraft] = useState<ExperienceLevel | null>(null);
  const [goalType, setGoalType] = useState<GoalType>("STRENGTH");
  const [goalTitle, setGoalTitle] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const experienceLevel = levelDraft ?? profile?.experienceLevel ?? null;
  const isGoalMissing = !profile || profile.goals.length === 0;

  const profileMutation = useMutation<void, Error, ExperienceLevel>({
    mutationFn: async (level) => {
      await userApi.updateProfile({ experienceLevel: level });
      if (isGoalMissing) {
        await userApi.upsertGoal({ goalType, title: goalTitle.trim() });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: () => setProfileError(AI_ERROR_FALLBACK),
  });

  const saveProfilePrerequisite = () => {
    if (!experienceLevel || (isGoalMissing && goalTitle.trim().length === 0)) {
      setProfileError(PROFILE_ERROR);
      return;
    }
    setProfileError(null);
    profileMutation.mutate(experienceLevel);
  };

  const bodyMetricsForm = useBodyMetricsForm(null);
  const bodyMetricsMutation = useSaveBodyMetrics();
  const [bodyMetricsError, setBodyMetricsError] = useState<string | null>(null);

  const saveBodyMetrics = () => {
    const result = bodyMetricsForm.validate();
    if (!result.isValid) {
      setBodyMetricsError(result.message);
      return;
    }
    setBodyMetricsError(null);
    bodyMetricsMutation.mutate(result.data, {
      onError: () => setBodyMetricsError(AI_ERROR_FALLBACK),
    });
  };

  const consentMutation = useAcceptAiConsent();
  const acceptConsent = () => consentMutation.mutate();

  return {
    step,
    isLoading,
    refetch,
    experienceLevel,
    goalType,
    goalTitle,
    profileError,
    isSavingProfile: profileMutation.isPending,
    setExperienceLevel: setLevelDraft,
    setGoalType,
    setGoalTitle,
    saveProfilePrerequisite,
    bodyMetricsForm,
    bodyMetricsError,
    isSavingBodyMetrics: bodyMetricsMutation.isPending,
    saveBodyMetrics,
    isAcceptingConsent: consentMutation.isPending,
    acceptConsent,
  };
};

export type AiPrerequisiteStepsState = ReturnType<
  typeof useAiPrerequisiteSteps
>;
