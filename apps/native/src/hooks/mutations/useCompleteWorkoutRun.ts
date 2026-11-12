import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkoutLogResponse } from "@repo/common";

import { workoutApi, workoutKeys } from "@src/api";

interface CompleteWorkoutRunVariables {
  workoutId: number;
  runId: number;
}

export const useCompleteWorkoutRun = () => {
  const queryClient = useQueryClient();

  return useMutation<WorkoutLogResponse, Error, CompleteWorkoutRunVariables>({
    mutationFn: ({ workoutId, runId }) =>
      workoutApi.completeLog(workoutId, runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
};
