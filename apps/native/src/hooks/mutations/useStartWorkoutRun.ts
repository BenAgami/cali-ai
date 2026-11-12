import { useMutation } from "@tanstack/react-query";
import type { WorkoutLogResponse } from "@repo/common";

import { workoutApi } from "@src/api";

/** Starting a plan opens a run; the response carries the run's id. */
export const useStartWorkoutRun = () =>
  useMutation<WorkoutLogResponse, Error, number>({
    mutationFn: (workoutId) => workoutApi.startLog(workoutId),
  });
