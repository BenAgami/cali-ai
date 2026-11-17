import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkoutRunResponse } from "@repo/common";

import { analysisKeys, workoutApi, workoutKeys } from "@src/api";

interface CompleteWorkoutRunVariables {
  workoutId: number;
  runId: number;
}

export const useCompleteWorkoutRun = () => {
  const queryClient = useQueryClient();

  return useMutation<WorkoutRunResponse, Error, CompleteWorkoutRunVariables>({
    mutationFn: ({ workoutId, runId }) =>
      workoutApi.completeRun(workoutId, runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
      void queryClient.invalidateQueries({ queryKey: analysisKeys.all });
    },
  });
};
