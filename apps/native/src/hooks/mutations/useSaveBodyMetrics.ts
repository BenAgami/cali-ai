import { useMutation, useQueryClient } from "@tanstack/react-query";

import { userApi, userKeys } from "@src/api";
import type { BodyMetricInput, SaveBodyMetricResponse } from "@repo/common";

export const useSaveBodyMetrics = () => {
  const queryClient = useQueryClient();

  return useMutation<SaveBodyMetricResponse, Error, BodyMetricInput>({
    mutationFn: userApi.saveBodyMetrics,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
};
