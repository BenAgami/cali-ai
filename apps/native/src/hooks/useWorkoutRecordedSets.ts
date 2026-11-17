import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { StatusCodes } from "http-status-codes";
import {
  API_ERROR_CODES,
  type AnalysisStatusEvent,
  type RecordedSetSummary,
} from "@repo/common";

import { ApiError } from "@src/api";

import { useAnalysisTracker } from "@src/context/AnalysisTrackerContext";
import { useRecordedSets } from "@src/hooks/queries/useRecordedSets";
import type { RetryIssue } from "@src/constants/formMessages";

type ProcessingStatus = RecordedSetSummary["processingStatus"];

export type WorkoutRecordedSet = RecordedSetSummary & {
  liveEvent?: AnalysisStatusEvent;
  effectiveStatus: ProcessingStatus;
  isUnseen: boolean;
  retryIssue: RetryIssue | null;
};

const toEffectiveStatus = (
  recorded: RecordedSetSummary,
  event: AnalysisStatusEvent | undefined,
): ProcessingStatus => {
  if (event === undefined) return recorded.processingStatus;
  return event.status === "QUEUED" ? "PROCESSING" : event.status;
};

const toRetryIssue = (
  status: ProcessingStatus,
  isLimitReached: boolean,
  hasRetryFailed: boolean,
): RetryIssue | null => {
  if (status !== "FAILED") return null;
  if (isLimitReached) return "LIMIT";
  return hasRetryFailed ? "FAILED" : null;
};

export const useWorkoutRecordedSets = (
  workoutPlanId: number | undefined,
  runId?: number,
) => {
  const {
    data,
    isLoading,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useRecordedSets(workoutPlanId, runId);
  const recordedSets = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const { tracked, statusByRecordedSet, unseenRecordedSetIds, track, retry } =
    useAnalysisTracker();
  const [retryingIds, setRetryingIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [isRetryLimitReached, setIsRetryLimitReached] = useState(false);
  const [retryFailedIds, setRetryFailedIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const hasRequestedTrack = useRef<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  // Re-attach to in-flight jobs that the tracker does not know about yet
  // (e.g. opened after an app restart before re-hydration finished).
  useEffect(() => {
    for (const recorded of recordedSets) {
      const isTracked = tracked.some(
        (entry) => entry.recordedSetId === recorded.recordedSetId,
      );
      if (
        recorded.processingStatus !== "PROCESSING" ||
        recorded.bullmqJobId === null ||
        isTracked ||
        hasRequestedTrack.current.has(recorded.recordedSetId)
      ) {
        continue;
      }
      hasRequestedTrack.current.add(recorded.recordedSetId);
      track({
        recordedSetId: recorded.recordedSetId,
        jobId: recorded.bullmqJobId,
        workoutPlanId: recorded.workoutPlanId,
        setNumber: recorded.setNumber,
        exerciseCode: recorded.exerciseCode,
        exerciseDisplayName: recorded.exerciseDisplayName,
      });
    }
  }, [recordedSets, tracked, track]);

  const items = useMemo<WorkoutRecordedSet[]>(
    () =>
      recordedSets.map((recorded) => {
        const liveEvent = statusByRecordedSet[recorded.recordedSetId];
        const effectiveStatus = toEffectiveStatus(recorded, liveEvent);
        return {
          ...recorded,
          liveEvent,
          effectiveStatus,
          isUnseen: unseenRecordedSetIds.has(recorded.recordedSetId),
          retryIssue: toRetryIssue(
            effectiveStatus,
            isRetryLimitReached,
            retryFailedIds.has(recorded.recordedSetId),
          ),
        };
      }),
    [
      recordedSets,
      statusByRecordedSet,
      unseenRecordedSetIds,
      isRetryLimitReached,
      retryFailedIds,
    ],
  );

  const retrySet = useCallback(
    async (recordedSetId: number) => {
      setRetryingIds((current) => new Set(current).add(recordedSetId));
      try {
        await retry(recordedSetId);
        setRetryFailedIds((current) => {
          const next = new Set(current);
          next.delete(recordedSetId);
          return next;
        });
        await refetch();
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === Number(StatusCodes.TOO_MANY_REQUESTS) &&
          error.code === API_ERROR_CODES.DAILY_RETRY_LIMIT_REACHED
        ) {
          setIsRetryLimitReached(true);
        } else {
          // The row stays FAILED, so the Retry button remains available.
          setRetryFailedIds((current) => new Set(current).add(recordedSetId));
        }
      } finally {
        setRetryingIds((current) => {
          const next = new Set(current);
          next.delete(recordedSetId);
          return next;
        });
      }
    },
    [retry, refetch],
  );

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  return {
    items,
    isLoading,
    error,
    retryingIds,
    retrySet,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    loadMore,
  };
};
