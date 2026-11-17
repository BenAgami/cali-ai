import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@src/context/AuthContext";
import { workoutPlanApi, workoutPlanKeys } from "@src/api";
import type { WorkoutPlanWithExercises } from "@repo/common";

export const useWorkoutPlanDetail = (id: number | undefined) => {
  const { token } = useAuth();
  return useQuery<WorkoutPlanWithExercises, Error>({
    queryKey: workoutPlanKeys.detail(id!),
    queryFn: () => workoutPlanApi.get(id!),
    enabled: !!token && !!id,
    staleTime: 30 * 1000,
  });
};
