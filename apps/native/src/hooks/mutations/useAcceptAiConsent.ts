import { useMutation, useQueryClient } from "@tanstack/react-query";

import { userApi, userKeys } from "@src/api";

export const useAcceptAiConsent = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: userApi.acceptAiConsent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
};
