import { useMutation, useQueryClient } from "@tanstack/react-query";

import { workoutPlanApi, workoutPlanKeys } from "@src/api";
import type {
  CreateWorkoutPlanValues,
  WorkoutPlanWithExercises,
} from "@repo/common";

export const useCreateWorkoutPlan = () => {
  const queryClient = useQueryClient();

  return useMutation<WorkoutPlanWithExercises, Error, CreateWorkoutPlanValues>({
    mutationFn: (data: CreateWorkoutPlanValues) => workoutPlanApi.create(data),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: workoutPlanKeys.lists() });
      queryClient.setQueryData(workoutPlanKeys.detail(created.id), created);
    },
  });
};
