import { useState } from "react";
import { router } from "expo-router";
import { StatusCodes } from "http-status-codes";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError, userApi, userKeys } from "@src/api";
import { useProfile } from "@src/hooks/queries/useProfile";
import { useBodyMetricsForm } from "@src/hooks/useBodyMetricsForm";
import { useAcceptAiConsent } from "@src/hooks/mutations/useAcceptAiConsent";
import { useCreateWorkout } from "@src/hooks/mutations/useCreateWorkout";
import { useGenerateWorkout } from "@src/hooks/mutations/useGenerateWorkout";
import { useSaveBodyMetrics } from "@src/hooks/mutations/useSaveBodyMetrics";
import {
  AI_ALREADY_SAVED_TEXT,
  AI_ERROR_FALLBACK,
  AI_ERROR_MESSAGES,
} from "@src/constants/aiMessages";
import { setGeneratedPlan } from "@src/state/generatedPlanStore";
import {
  generateWorkoutSchema,
  getMissingAiPrerequisites,
  type AiPrerequisiteCode,
  type ExperienceLevel,
  type GoalType,
  type WorkoutGenerationPreview,
} from "@repo/common";

export type GenerateStep = AiPrerequisiteCode | "READY";

const GENERATION_ALREADY_SAVED = "GENERATION_ALREADY_SAVED";
const PROFILE_ERROR = "Choose a level and enter a goal.";

const formatPreviewRow = (
  ex: WorkoutGenerationPreview["exercises"][number],
): string => {
  const volume =
    ex.exercise.exerciseType === "STATIC_HOLD" && ex.durationSecs != null
      ? `${ex.sets} × ${ex.durationSecs}s hold`
      : ex.reps != null
        ? `${ex.sets} × ${ex.reps}`
        : `${ex.sets} sets`;
  return `${ex.exercise.displayName} — ${volume} · ${ex.restSecs}s rest`;
};

export const useWorkoutGenerate = () => {
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
  const step: GenerateStep = missing.at(0) ?? "READY";

  // Profile prerequisite
  const [levelDraft, setLevelDraft] = useState<ExperienceLevel | null>(null);
  const [goalType, setGoalType] = useState<GoalType>("STRENGTH");
  const [goalTitle, setGoalTitle] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const experienceLevel = levelDraft ?? profile?.experienceLevel ?? null;
  const needsGoal = !profile || profile.goals.length === 0;

  const profileMutation = useMutation<void, Error, ExperienceLevel>({
    mutationFn: async (level) => {
      await userApi.updateProfile({ experienceLevel: level });
      if (needsGoal) {
        await userApi.upsertGoal({ goalType, title: goalTitle.trim() });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: () => setProfileError(AI_ERROR_FALLBACK),
  });

  const saveProfilePrerequisite = () => {
    if (!experienceLevel || (needsGoal && goalTitle.trim().length === 0)) {
      setProfileError(PROFILE_ERROR);
      return;
    }
    setProfileError(null);
    profileMutation.mutate(experienceLevel);
  };

  // Body metrics prerequisite
  const bodyMetricsForm = useBodyMetricsForm(null);
  const bodyMetricsMutation = useSaveBodyMetrics();
  const [bodyMetricsError, setBodyMetricsError] = useState<string | null>(null);

  const saveBodyMetrics = () => {
    const result = bodyMetricsForm.validate();
    if (!result.ok) {
      setBodyMetricsError(result.message);
      return;
    }
    setBodyMetricsError(null);
    bodyMetricsMutation.mutate(result.data, {
      onError: () => setBodyMetricsError(AI_ERROR_FALLBACK),
    });
  };

  // Consent
  const consentMutation = useAcceptAiConsent();
  const acceptConsent = () => consentMutation.mutate();

  // Generation
  const [goalText, setGoalText] = useState("");
  const [preview, setPreview] = useState<WorkoutGenerationPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const generateMutation = useGenerateWorkout();
  const createMutation = useCreateWorkout();

  const canGenerate =
    step === "READY" &&
    generateWorkoutSchema.safeParse({ goalText }).success &&
    !generateMutation.isPending;

  const runGenerate = () => {
    setErrorMessage(null);
    setPreview(null);
    generateMutation.mutate(
      { goalText },
      {
        onSuccess: setPreview,
        onError: (err) => {
          if (
            err instanceof ApiError &&
            err.status === Number(StatusCodes.PRECONDITION_REQUIRED)
          ) {
            void refetch();
            return;
          }
          const code = err instanceof ApiError ? err.code : undefined;
          setErrorMessage(AI_ERROR_MESSAGES[code ?? ""] ?? AI_ERROR_FALLBACK);
        },
      },
    );
  };

  const generate = () => {
    if (canGenerate) runGenerate();
  };

  const regenerate = () => {
    if (!generateMutation.isPending) runGenerate();
  };

  const save = () => {
    if (!preview) return;
    setErrorMessage(null);
    createMutation.mutate(
      {
        name: preview.name,
        exercises: preview.exercises.map(
          ({ exerciseId, sets, reps, durationSecs, restSecs }) => ({
            exerciseId,
            sets,
            reps,
            durationSecs,
            restSecs,
          }),
        ),
        generationId: preview.generationId,
      },
      {
        onSuccess: (created) =>
          router.replace({
            pathname: "/workout-detail",
            params: { id: String(created.id) },
          }),
        onError: (err) => {
          const alreadySaved =
            err instanceof ApiError && err.code === GENERATION_ALREADY_SAVED;
          setErrorMessage(
            alreadySaved ? AI_ALREADY_SAVED_TEXT : AI_ERROR_FALLBACK,
          );
        },
      },
    );
  };

  const editInBuilder = () => {
    if (!preview) return;
    setGeneratedPlan(preview);
    router.push({
      pathname: "/workout-builder",
      params: { fromGeneration: "1" },
    });
  };

  return {
    loading: isLoading,
    editInBuilder,
    step,
    experienceLevel,
    goalType,
    goalTitle,
    profileError,
    savingProfile: profileMutation.isPending,
    setExperienceLevel: setLevelDraft,
    setGoalType,
    setGoalTitle,
    saveProfilePrerequisite,
    bodyMetricsForm,
    bodyMetricsError,
    savingBodyMetrics: bodyMetricsMutation.isPending,
    saveBodyMetrics,
    acceptingConsent: consentMutation.isPending,
    acceptConsent,
    goalText,
    setGoalText,
    selectExample: setGoalText,
    canGenerate,
    generating: generateMutation.isPending,
    generate,
    regenerate,
    preview,
    previewRows: preview ? preview.exercises.map(formatPreviewRow) : [],
    saving: createMutation.isPending,
    save,
    errorMessage,
  };
};
