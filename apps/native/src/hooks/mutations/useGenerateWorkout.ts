import { useMutation } from "@tanstack/react-query";

import { workoutApi } from "@src/api";
import type {
  GenerateWorkoutValues,
  WorkoutGenerationPreview,
} from "@repo/common";

export const useGenerateWorkout = () =>
  useMutation<WorkoutGenerationPreview, Error, GenerateWorkoutValues>({
    mutationFn: workoutApi.generate,
    retry: false,
  });
