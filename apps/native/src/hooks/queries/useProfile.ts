import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@src/context/AuthContext";
import { userApi, userKeys } from "@src/api";
import type { UserProfile } from "@repo/common";

export const useProfile = () => {
  const { token } = useAuth();

  return useQuery<UserProfile, Error>({
    queryKey: userKeys.me(),
    queryFn: () => userApi.getMe(),
    enabled: !!token,
  });
};
