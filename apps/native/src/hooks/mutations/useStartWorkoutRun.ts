import { useMutation, useQueryClient } from "@tanstack/react-query";

import { workoutApi, workoutKeys } from "@src/api";
import type { WorkoutLogValues, WorkoutLogResponse } from "@repo/common";

interface StartWorkoutVariables {
  workoutId: number;
  data: WorkoutLogValues;
}

export const useStartWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation<WorkoutLogResponse, Error, StartWorkoutVariables>({
    mutationFn: ({ workoutId, data }) => workoutApi.startLog(workoutId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
};
