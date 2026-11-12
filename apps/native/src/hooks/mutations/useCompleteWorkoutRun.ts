import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CompleteWorkoutLogValues,
  WorkoutLogResponse,
} from "@repo/common";

import { workoutApi, workoutKeys } from "@src/api";

interface CompleteWorkoutRunVariables {
  workoutId: number;
  runId: number;
  data: CompleteWorkoutLogValues;
}

export const useCompleteWorkoutRun = () => {
  const queryClient = useQueryClient();

  return useMutation<WorkoutLogResponse, Error, CompleteWorkoutRunVariables>({
    mutationFn: ({ workoutId, runId, data }) =>
      workoutApi.completeLog(workoutId, runId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
};
