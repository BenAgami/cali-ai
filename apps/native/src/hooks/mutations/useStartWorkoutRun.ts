import { useMutation } from "@tanstack/react-query";
import type { WorkoutRunResponse } from "@repo/common";

import { workoutApi } from "@src/api";

/** Starting a plan opens a run; the response carries the run's id. */
export const useStartWorkoutRun = () =>
  useMutation<WorkoutRunResponse, Error, number>({
    mutationFn: (workoutId) => workoutApi.startRun(workoutId),
  });
