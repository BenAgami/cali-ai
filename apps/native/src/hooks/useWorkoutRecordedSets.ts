import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { AnalysisStatusEvent, RecordedSet } from "@repo/common";

import { useAnalysisTracker } from "@src/context/AnalysisTrackerContext";
import { useRecordedSets } from "@src/hooks/queries/useRecordedSets";

type SessionStatus = RecordedSet["processingStatus"];

export type WorkoutRecordedSet = RecordedSet & {
  liveEvent?: AnalysisStatusEvent;
  effectiveStatus: SessionStatus;
  isUnseen: boolean;
};

const toEffectiveStatus = (
  recorded: RecordedSet,
  event: AnalysisStatusEvent | undefined,
): SessionStatus => {
  if (event === undefined) return recorded.processingStatus;
  return event.status === "QUEUED" ? "PROCESSING" : event.status;
};

export const useWorkoutRecordedSets = (workoutId: number | undefined) => {
  const { data, isLoading, error, refetch } = useRecordedSets(workoutId);
  const { tracked, statusBySession, unseenSessionIds, track, retry } =
    useAnalysisTracker();
  const [retryingIds, setRetryingIds] = useState<ReadonlySet<number>>(
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
    if (data === undefined) return;
    for (const recorded of data) {
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
  }, [data, tracked, track]);

  const items = useMemo<WorkoutRecordedSet[]>(
    () =>
      (data ?? []).map((recorded) => {
        const liveEvent = statusBySession[recorded.sessionId];
        return {
          ...recorded,
          liveEvent,
          effectiveStatus: toEffectiveStatus(recorded, liveEvent),
          isUnseen: unseenSessionIds.has(recorded.sessionId),
        };
      }),
    [data, statusBySession, unseenSessionIds],
  );

  const retrySet = useCallback(
    async (sessionId: number) => {
      setRetryingIds((current) => new Set(current).add(sessionId));
      try {
        await retry(sessionId);
        await refetch();
      } catch {
        // The row stays FAILED, so the Retry button remains available.
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

  return { items, isLoading, error, retryingIds, retrySet };
};
