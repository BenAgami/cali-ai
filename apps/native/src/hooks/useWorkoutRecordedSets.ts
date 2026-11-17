import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { StatusCodes } from "http-status-codes";
import {
  API_ERROR_CODES,
  type AnalysisStatusEvent,
  type RecordedSet,
} from "@repo/common";

import { ApiError } from "@src/api";

import { useAnalysisTracker } from "@src/context/AnalysisTrackerContext";
import { useRecordedSets } from "@src/hooks/queries/useRecordedSets";
import type { RetryIssue } from "@src/constants/formMessages";

type SessionStatus = RecordedSet["processingStatus"];

export type WorkoutRecordedSet = RecordedSet & {
  liveEvent?: AnalysisStatusEvent;
  effectiveStatus: SessionStatus;
  isUnseen: boolean;
  retryIssue: RetryIssue | null;
};

const toEffectiveStatus = (
  recorded: RecordedSet,
  event: AnalysisStatusEvent | undefined,
): SessionStatus => {
  if (event === undefined) return recorded.processingStatus;
  return event.status === "QUEUED" ? "PROCESSING" : event.status;
};

const toRetryIssue = (
  status: SessionStatus,
  isLimitReached: boolean,
  hasRetryFailed: boolean,
): RetryIssue | null => {
  if (status !== "FAILED") return null;
  if (isLimitReached) return "LIMIT";
  return hasRetryFailed ? "FAILED" : null;
};

export const useWorkoutRecordedSets = (
  workoutId: number | undefined,
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
  } = useRecordedSets(workoutId, runId);
  const recordedSets = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );
  const { tracked, statusBySession, unseenSessionIds, track, retry } =
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
        (entry) => entry.sessionId === recorded.sessionId,
      );
      if (
        recorded.processingStatus !== "PROCESSING" ||
        recorded.bullmqJobId === null ||
        isTracked ||
        hasRequestedTrack.current.has(recorded.sessionId)
      ) {
        continue;
      }
      hasRequestedTrack.current.add(recorded.sessionId);
      track({
        sessionId: recorded.sessionId,
        jobId: recorded.bullmqJobId,
        workoutId: recorded.workoutId,
        setNumber: recorded.setNumber,
        exerciseCode: recorded.exerciseCode,
        exerciseDisplayName: recorded.exerciseDisplayName,
      });
    }
  }, [recordedSets, tracked, track]);

  const items = useMemo<WorkoutRecordedSet[]>(
    () =>
      recordedSets.map((recorded) => {
        const liveEvent = statusBySession[recorded.sessionId];
        const effectiveStatus = toEffectiveStatus(recorded, liveEvent);
        return {
          ...recorded,
          liveEvent,
          effectiveStatus,
          isUnseen: unseenSessionIds.has(recorded.sessionId),
          retryIssue: toRetryIssue(
            effectiveStatus,
            isRetryLimitReached,
            retryFailedIds.has(recorded.sessionId),
          ),
        };
      }),
    [
      recordedSets,
      statusBySession,
      unseenSessionIds,
      isRetryLimitReached,
      retryFailedIds,
    ],
  );

  const retrySet = useCallback(
    async (sessionId: number) => {
      setRetryingIds((current) => new Set(current).add(sessionId));
      try {
        await retry(sessionId);
        setRetryFailedIds((current) => {
          const next = new Set(current);
          next.delete(sessionId);
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
          setRetryFailedIds((current) => new Set(current).add(sessionId));
        }
      } finally {
        setRetryingIds((current) => {
          const next = new Set(current);
          next.delete(sessionId);
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
