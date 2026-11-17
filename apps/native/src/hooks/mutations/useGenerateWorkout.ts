import { useMutation } from "@tanstack/react-query";

import { workoutPlanApi } from "@src/api";
import type {
  GenerateWorkoutValues,
  WorkoutGenerationPreview,
} from "@repo/common";

export const useGenerateWorkout = () =>
  useMutation<WorkoutGenerationPreview, Error, GenerateWorkoutValues>({
    mutationFn: workoutPlanApi.generate,
    retry: false,
  });
