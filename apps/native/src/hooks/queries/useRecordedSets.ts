import { useQuery } from "@tanstack/react-query";
import type { RecordedSet } from "@repo/common";

import { analysisKeys, workoutApi } from "@src/api";

/** Without a run id, the recorded sets of every run of the workout. */
export const useRecordedSets = (
  workoutId: number | undefined,
  runId?: number,
) =>
  useQuery<RecordedSet[], Error>({
    queryKey: analysisKeys.recordedSets(workoutId!, runId),
    queryFn: () => workoutApi.recordedSets(workoutId!, runId),
    enabled: workoutId !== undefined,
    staleTime: 0,
    refetchOnMount: "always",
  });
