import { useInfiniteQuery } from "@tanstack/react-query";
import type { RecordedSetPage } from "@repo/common";

import { analysisKeys, workoutApi } from "@src/api";

const FIRST_PAGE_OFFSET = 0;

/** Without a run id, the recorded sets of every run of the workout. */
export const useRecordedSets = (
  workoutId: number | undefined,
  runId?: number,
) =>
  useInfiniteQuery({
    queryKey: analysisKeys.recordedSets(workoutId!, runId),
    queryFn: ({ pageParam }) =>
      workoutApi.recordedSets(workoutId!, runId, pageParam),
    initialPageParam: FIRST_PAGE_OFFSET,
    getNextPageParam: (lastPage: RecordedSetPage) =>
      lastPage.page.nextOffset ?? undefined,
    enabled: workoutId !== undefined,
    staleTime: 0,
    refetchOnMount: "always",
  });
