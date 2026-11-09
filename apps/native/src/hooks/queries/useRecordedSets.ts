import { useQuery } from "@tanstack/react-query";
import type { RecordedSet } from "@repo/common";

import { analysisKeys, workoutApi } from "@src/api";

export const useRecordedSets = (workoutId: number | undefined) =>
  useQuery<RecordedSet[], Error>({
    queryKey: analysisKeys.recordedSets(workoutId!),
    queryFn: () => workoutApi.recordedSets(workoutId!),
    enabled: workoutId !== undefined,
    staleTime: 0,
    refetchOnMount: "always",
  });
