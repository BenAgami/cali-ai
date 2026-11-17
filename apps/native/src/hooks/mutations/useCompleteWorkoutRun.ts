import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkoutRunResponse } from "@repo/common";

import { analysisKeys, workoutPlanApi, workoutPlanKeys } from "@src/api";

interface CompleteWorkoutRunVariables {
  workoutPlanId: number;
  runId: number;
}

export const useCompleteWorkoutRun = () => {
  const queryClient = useQueryClient();

  return useMutation<WorkoutRunResponse, Error, CompleteWorkoutRunVariables>({
    mutationFn: ({ workoutPlanId, runId }) =>
      workoutPlanApi.completeRun(workoutPlanId, runId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutPlanKeys.all });
      void queryClient.invalidateQueries({ queryKey: analysisKeys.all });
    },
  });
};
