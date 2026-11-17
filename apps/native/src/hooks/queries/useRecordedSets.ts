import { useInfiniteQuery } from "@tanstack/react-query";
import type { RecordedSetPage } from "@repo/common";

import { analysisKeys, workoutPlanApi } from "@src/api";

const FIRST_PAGE_OFFSET = 0;

/** Without a run id, the recorded sets of every run of the workout. */
export const useRecordedSets = (
  workoutPlanId: number | undefined,
  runId?: number,
) =>
  useInfiniteQuery({
    queryKey: analysisKeys.recordedSets(workoutPlanId!, runId),
    queryFn: ({ pageParam }) =>
      workoutPlanApi.recordedSets(workoutPlanId!, runId, pageParam),
    initialPageParam: FIRST_PAGE_OFFSET,
    getNextPageParam: (lastPage: RecordedSetPage) =>
      lastPage.page.nextOffset ?? undefined,
    enabled: workoutPlanId !== undefined,
    staleTime: 0,
    refetchOnMount: "always",
  });
