import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Alert } from "react-native";

import type {
  CreateWorkoutPlanValues,
  WorkoutPlanWithExercises,
  ExerciseType,
} from "@repo/common";
import type { DraftExerciseValues } from "@src/components/WorkoutExerciseRow";

import { useWorkoutPlanDetail } from "@src/hooks/queries/useWorkoutPlanDetail";
import { useCreateWorkoutPlan } from "@src/hooks/mutations/useCreateWorkoutPlan";
import { useUpdateWorkoutPlan } from "@src/hooks/mutations/useUpdateWorkoutPlan";
import { consumeGeneratedPlan } from "@src/state/generatedPlanStore";

export interface DraftExercise extends DraftExerciseValues {
  localId: string;
  exerciseId: number;
  exerciseCode: string;
  exerciseDisplayName: string;
  exerciseType: ExerciseType;
}

const makeLocalId = (): string =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const draftFromServer = (workout: WorkoutPlanWithExercises): DraftExercise[] =>
  workout.exercises.map((ex) => ({
    localId: makeLocalId(),
    exerciseId: ex.exerciseId,
    exerciseCode: ex.exercise.code,
    exerciseDisplayName: ex.exercise.displayName,
    exerciseType: ex.exercise.exerciseType,
    sets: ex.sets,
    reps: ex.reps,
    durationSecs: ex.durationSecs,
    restSecs: ex.restSecs,
  }));

export interface UseWorkoutBuilderOptions {
  workoutPlanId?: number;
  isFromGeneration?: boolean;
}

export const useWorkoutBuilder = (options: UseWorkoutBuilderOptions) => {
  const isEdit = options.workoutPlanId != null;
  const detailQuery = useWorkoutPlanDetail(options.workoutPlanId);
  const createMutation = useCreateWorkoutPlan();
  const updateMutation = useUpdateWorkoutPlan();

  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [generationId, setGenerationId] = useState<number | undefined>(
    undefined,
  );
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    if (isEdit || !options.isFromGeneration) return;
    seededRef.current = true;
    const plan = consumeGeneratedPlan();
    if (!plan) return;
    setName(plan.name);
    setExercises(
      plan.exercises.map((ex) => ({
        localId: makeLocalId(),
        exerciseId: ex.exerciseId,
        exerciseCode: ex.exercise.code,
        exerciseDisplayName: ex.exercise.displayName,
        exerciseType: ex.exercise.exerciseType,
        sets: ex.sets,
        reps: ex.reps,
        durationSecs: ex.durationSecs,
        restSecs: ex.restSecs,
      })),
    );
    setGenerationId(plan.generationId);
  }, [isEdit, options.isFromGeneration]);

  useEffect(() => {
    if (!isEdit) return;
    if (seededRef.current) return;
    if (!detailQuery.data) return;
    seededRef.current = true;
    setName(detailQuery.data.name);
    setExercises(draftFromServer(detailQuery.data));
  }, [isEdit, detailQuery.data]);

  const addExercise = useCallback(
    (input: {
      exerciseId: number;
      exerciseCode: string;
      exerciseDisplayName: string;
      exerciseType: ExerciseType;
    }) => {
      const isStatic = input.exerciseType === "STATIC_HOLD";
      setExercises((prev) => [
        ...prev,
        {
          localId: makeLocalId(),
          ...input,
          sets: 3,
          reps: isStatic ? null : 8,
          durationSecs: isStatic ? 30 : null,
          restSecs: 60,
        },
      ]);
    },
    [],
  );

  const updateExercise = useCallback(
    (localId: string, values: DraftExerciseValues) => {
      setExercises((prev) =>
        prev.map((ex) => (ex.localId === localId ? { ...ex, ...values } : ex)),
      );
    },
    [],
  );

  const removeExercise = useCallback((localId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.localId !== localId));
  }, []);

  const reorderExercises = useCallback((next: DraftExercise[]) => {
    setExercises(next);
  }, []);

  const validation = useMemo(() => {
    const trimmed = name.trim();
    if (trimmed.length < 1)
      return { isValid: false, message: "Name is required" } as const;
    if (trimmed.length > 100)
      return { isValid: false, message: "Name max 100 chars" } as const;
    if (exercises.length < 1)
      return { isValid: false, message: "Add at least one exercise" } as const;
    if (exercises.length > 50)
      return {
        isValid: false,
        message: "Max 50 exercises per workout",
      } as const;
    for (const ex of exercises) {
      const isStatic = ex.exerciseType === "STATIC_HOLD";
      if (isStatic && (ex.durationSecs == null || ex.durationSecs < 1)) {
        return {
          isValid: false,
          message: "Static Hold exercises need a duration",
        } as const;
      }
      if (!isStatic && (ex.reps == null || ex.reps < 1)) {
        return {
          isValid: false,
          message: "Dynamic exercises need reps",
        } as const;
      }
    }
    return { isValid: true } as const;
  }, [name, exercises]);

  const buildPayload = useCallback((): CreateWorkoutPlanValues => {
    return {
      name: name.trim(),
      exercises: exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets,
        reps: ex.exerciseType === "STATIC_HOLD" ? null : ex.reps,
        durationSecs:
          ex.exerciseType === "STATIC_HOLD" ? ex.durationSecs : null,
        restSecs: ex.restSecs,
      })),
      ...(generationId !== undefined && !isEdit ? { generationId } : {}),
    };
  }, [name, exercises, generationId, isEdit]);

  const save = useCallback(
    async (
      onCreated: (workoutPlanId: number) => void,
      onUpdated: (workoutPlanId: number) => void,
    ) => {
      if (!validation.isValid) {
        Alert.alert("Cannot save", validation.message ?? "Invalid workout");
        return;
      }
      const payload = buildPayload();
      try {
        if (isEdit && options.workoutPlanId != null) {
          const updated = await updateMutation.mutateAsync({
            id: options.workoutPlanId,
            data: payload,
          });
          onUpdated(updated.id);
        } else {
          const created = await createMutation.mutateAsync(payload);
          onCreated(created.id);
        }
      } catch {
        Alert.alert("Error", "Could not save workout. Please try again.");
      }
    },
    [
      validation,
      buildPayload,
      isEdit,
      options.workoutPlanId,
      createMutation,
      updateMutation,
    ],
  );

  return {
    isEdit,
    isLoading: isEdit && detailQuery.isLoading && !seededRef.current,
    error: detailQuery.error,
    name,
    setName,
    exercises,
    addExercise,
    updateExercise,
    removeExercise,
    reorderExercises,
    validation,
    save,
    isSaving: createMutation.isPending || updateMutation.isPending,
    isAiDraft: generationId !== undefined,
  };
};
