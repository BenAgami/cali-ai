import { useMutation, useQueryClient } from "@tanstack/react-query";

import { workoutPlanApi, workoutPlanKeys } from "@src/api";
import type {
  UpdateWorkoutPlanValues,
  WorkoutPlanWithExercises,
} from "@repo/common";

interface UpdateWorkoutPlanVariables {
  id: number;
  data: UpdateWorkoutPlanValues;
}

export const useUpdateWorkoutPlan = () => {
  const queryClient = useQueryClient();

  return useMutation<
    WorkoutPlanWithExercises,
    Error,
    UpdateWorkoutPlanVariables
  >({
    mutationFn: ({ id, data }) => workoutPlanApi.update(id, data),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: workoutPlanKeys.lists() });
      queryClient.setQueryData(workoutPlanKeys.detail(updated.id), updated);
    },
  });
};
