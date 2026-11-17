import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@src/context/AuthContext";
import { workoutPlanApi, workoutPlanKeys } from "@src/api";
import type { WorkoutPlanListResponse } from "@repo/common";

const PAGE_SIZE = 50;

export const useWorkoutPlans = () => {
  const { token } = useAuth();
  return useQuery<WorkoutPlanListResponse, Error>({
    queryKey: workoutPlanKeys.lists(),
    queryFn: () => workoutPlanApi.list({ limit: PAGE_SIZE, offset: 0 }),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
};
