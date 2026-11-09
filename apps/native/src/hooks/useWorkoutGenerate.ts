import { useState } from "react";
import { router } from "expo-router";
import { StatusCodes } from "http-status-codes";

import { ApiError } from "@src/api";
import { useCreateWorkout } from "@src/hooks/mutations/useCreateWorkout";
import { useGenerateWorkout } from "@src/hooks/mutations/useGenerateWorkout";
import {
  useAiPrerequisiteSteps,
  type AiPrerequisiteStep,
} from "@src/hooks/useAiPrerequisiteSteps";
import {
  AI_ALREADY_SAVED_TEXT,
  AI_ERROR_FALLBACK,
  AI_ERROR_MESSAGES,
} from "@src/constants/aiMessages";
import { setGeneratedPlan } from "@src/state/generatedPlanStore";
import {
  generateWorkoutSchema,
  type WorkoutGenerationPreview,
} from "@repo/common";

export type GenerateStep = AiPrerequisiteStep;

const GENERATION_ALREADY_SAVED = "GENERATION_ALREADY_SAVED";

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
  const prerequisites = useAiPrerequisiteSteps();
  const { step, refetch } = prerequisites;

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
    ...prerequisites,
    editInBuilder,
    goalText,
    setGoalText,
    selectExample: setGoalText,
    canGenerate,
    isGenerating: generateMutation.isPending,
    generate,
    regenerate,
    preview,
    previewRows: preview ? preview.exercises.map(formatPreviewRow) : [],
    isSaving: createMutation.isPending,
    save,
    errorMessage,
  };
};
