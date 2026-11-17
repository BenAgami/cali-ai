import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AnalysisStatusEvent } from "@repo/common";

import { analysisKeys, recordedSetsApi } from "@src/api";
import { useAnalysisStatus } from "@src/hooks/useAnalysisStatus";

export type TrackedAnalysis = {
  recordedSetId: number;
  jobId: string;
  workoutPlanId: number | null;
  setNumber: number | null;
  exerciseCode: string;
  exerciseDisplayName: string;
};

export type AnalysisToastState = {
  recordedSetId: number;
  title: string;
  body: string;
};

type AnalysisTrackerValue = {
  tracked: TrackedAnalysis[];
  statusByRecordedSet: Record<number, AnalysisStatusEvent | undefined>;
  unseenRecordedSetIds: ReadonlySet<number>;
  track: (item: TrackedAnalysis) => void;
  retry: (recordedSetId: number) => Promise<void>;
  markSeen: (recordedSetId: number) => void;
  toast: AnalysisToastState | null;
  dismissToast: () => void;
};

const AnalysisTrackerContext = createContext<AnalysisTrackerValue | null>(null);

type AnalysisWatcherProps = {
  item: TrackedAnalysis;
  onEvent: (item: TrackedAnalysis, event: AnalysisStatusEvent) => void;
};

const AnalysisWatcher: React.FC<AnalysisWatcherProps> = ({ item, onEvent }) => {
  const { event } = useAnalysisStatus(item.recordedSetId, item.jobId);

  useEffect(() => {
    if (event !== null) onEvent(item, event);
  }, [event, item, onEvent]);

  return null;
};

export const AnalysisTrackerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [tracked, setTracked] = useState<TrackedAnalysis[]>([]);
  const [statusByRecordedSet, setStatusByRecordedSet] = useState<
    Record<number, AnalysisStatusEvent | undefined>
  >({});
  const [unseenRecordedSetIds, setUnseenRecordedSetIds] = useState<
    ReadonlySet<number>
  >(() => new Set());
  const [toast, setToast] = useState<AnalysisToastState | null>(null);
  // Terminal events are handled once per recordedSetId:jobId run.
  const handledRuns = useRef<Set<string>>(new Set());

  const track = useCallback((item: TrackedAnalysis) => {
    setTracked((current) => [
      ...current.filter((entry) => entry.recordedSetId !== item.recordedSetId),
      item,
    ]);
  }, []);

  const handleEvent = useCallback(
    (item: TrackedAnalysis, event: AnalysisStatusEvent) => {
      setStatusByRecordedSet((current) => ({
        ...current,
        [item.recordedSetId]: event,
      }));

      const isTerminal =
        event.status === "COMPLETED" || event.status === "FAILED";
      if (!isTerminal) return;
      const runId = `${item.recordedSetId}:${item.jobId}`;
      if (handledRuns.current.has(runId)) return;
      handledRuns.current.add(runId);

      if (item.workoutPlanId !== null) {
        void queryClient.invalidateQueries({
          queryKey: analysisKeys.recordedSets(item.workoutPlanId),
        });
      }
      if (event.status !== "COMPLETED") return;

      void queryClient.invalidateQueries({
        queryKey: analysisKeys.recordedSet(item.recordedSetId),
      });
      setUnseenRecordedSetIds((current) =>
        new Set(current).add(item.recordedSetId),
      );
      setToast({
        recordedSetId: item.recordedSetId,
        title: "Feedback ready",
        body:
          item.setNumber !== null
            ? `${item.exerciseDisplayName} - set ${item.setNumber}`
            : item.exerciseDisplayName,
      });
    },
    [queryClient],
  );

  const retry = useCallback(async (recordedSetId: number) => {
    const accepted = await recordedSetsApi.retryAnalysis(recordedSetId);
    setStatusByRecordedSet((current) => ({
      ...current,
      [recordedSetId]: undefined,
    }));
    setTracked((current) =>
      current.map((entry) =>
        entry.recordedSetId === recordedSetId
          ? { ...entry, jobId: accepted.jobId }
          : entry,
      ),
    );
  }, []);

  const markSeen = useCallback((recordedSetId: number) => {
    setUnseenRecordedSetIds((current) => {
      if (!current.has(recordedSetId)) return current;
      const next = new Set(current);
      next.delete(recordedSetId);
      return next;
    });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  // Re-attach recorded sets still PROCESSING on the server after an app restart.
  useEffect(() => {
    let isCancelled = false;
    void (async () => {
      try {
        const response = await recordedSetsApi.listByStatus("PROCESSING");
        if (isCancelled) return;
        for (const recordedSet of response.items) {
          if (recordedSet.bullmqJobId === null) continue;
          track({
            recordedSetId: recordedSet.id,
            jobId: recordedSet.bullmqJobId,
            workoutPlanId: recordedSet.workoutPlanId,
            setNumber: recordedSet.setNumber,
            exerciseCode: recordedSet.exercise.code,
            exerciseDisplayName: recordedSet.exercise.displayName,
          });
        }
      } catch {
        // Silent: hydration is retried on the next mount.
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [track]);

  const value = useMemo<AnalysisTrackerValue>(
    () => ({
      tracked,
      statusByRecordedSet,
      unseenRecordedSetIds,
      track,
      retry,
      markSeen,
      toast,
      dismissToast,
    }),
    [
      tracked,
      statusByRecordedSet,
      unseenRecordedSetIds,
      track,
      retry,
      markSeen,
      toast,
      dismissToast,
    ],
  );

  return (
    <AnalysisTrackerContext.Provider value={value}>
      {children}
      {tracked.map((item) => (
        <AnalysisWatcher
          key={`${item.recordedSetId}:${item.jobId}`}
          item={item}
          onEvent={handleEvent}
        />
      ))}
    </AnalysisTrackerContext.Provider>
  );
};

export const useAnalysisTracker = (): AnalysisTrackerValue => {
  const value = useContext(AnalysisTrackerContext);
  if (value === null) {
    throw new Error(
      "useAnalysisTracker must be used within an AnalysisTrackerProvider",
    );
  }
  return value;
};
