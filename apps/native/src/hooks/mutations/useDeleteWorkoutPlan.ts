import { useMutation, useQueryClient } from "@tanstack/react-query";

import { workoutPlanApi, workoutPlanKeys } from "@src/api";

export const useDeleteWorkoutPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => workoutPlanApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workoutPlanKeys.all });
    },
  });
};
