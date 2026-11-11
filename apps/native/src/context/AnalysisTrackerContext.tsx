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

import { analysisKeys, sessionsApi } from "@src/api";
import { useAnalysisStatus } from "@src/hooks/useAnalysisStatus";

export type TrackedAnalysis = {
  sessionId: number;
  jobId: string;
  workoutId: number | null;
  setNumber: number | null;
  exerciseCode: string;
  exerciseDisplayName: string;
};

export type AnalysisToastState = {
  sessionId: number;
  title: string;
  body: string;
};

type AnalysisTrackerValue = {
  tracked: TrackedAnalysis[];
  statusBySession: Record<number, AnalysisStatusEvent | undefined>;
  unseenSessionIds: ReadonlySet<number>;
  track: (item: TrackedAnalysis) => void;
  retry: (sessionId: number) => Promise<void>;
  markSeen: (sessionId: number) => void;
  entriesForWorkout: (workoutId: number) => TrackedAnalysis[];
  toast: AnalysisToastState | null;
  dismissToast: () => void;
};

const AnalysisTrackerContext = createContext<AnalysisTrackerValue | null>(null);

type AnalysisWatcherProps = {
  item: TrackedAnalysis;
  onEvent: (item: TrackedAnalysis, event: AnalysisStatusEvent) => void;
};

const AnalysisWatcher: React.FC<AnalysisWatcherProps> = ({ item, onEvent }) => {
  const { event } = useAnalysisStatus(item.sessionId, item.jobId);

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
  const [statusBySession, setStatusBySession] = useState<
    Record<number, AnalysisStatusEvent | undefined>
  >({});
  const [unseenSessionIds, setUnseenSessionIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [toast, setToast] = useState<AnalysisToastState | null>(null);
  // Terminal events are handled once per sessionId:jobId run.
  const handledRuns = useRef<Set<string>>(new Set());

  const track = useCallback((item: TrackedAnalysis) => {
    setTracked((current) => [
      ...current.filter((entry) => entry.sessionId !== item.sessionId),
      item,
    ]);
  }, []);

  const handleEvent = useCallback(
    (item: TrackedAnalysis, event: AnalysisStatusEvent) => {
      setStatusBySession((current) => ({
        ...current,
        [item.sessionId]: event,
      }));

      const isTerminal =
        event.status === "COMPLETED" || event.status === "FAILED";
      if (!isTerminal) return;
      const runId = `${item.sessionId}:${item.jobId}`;
      if (handledRuns.current.has(runId)) return;
      handledRuns.current.add(runId);

      if (item.workoutId !== null) {
        void queryClient.invalidateQueries({
          queryKey: analysisKeys.recordedSets(item.workoutId),
        });
      }
      if (event.status !== "COMPLETED") return;

      void queryClient.invalidateQueries({
        queryKey: analysisKeys.session(item.sessionId),
      });
      setUnseenSessionIds((current) => new Set(current).add(item.sessionId));
      setToast({
        sessionId: item.sessionId,
        title: "Feedback ready",
        body:
          item.setNumber !== null
            ? `${item.exerciseDisplayName} - set ${item.setNumber}`
            : item.exerciseDisplayName,
      });
    },
    [queryClient],
  );

  const retry = useCallback(async (sessionId: number) => {
    const accepted = await sessionsApi.retryAnalysis(sessionId);
    setStatusBySession((current) => ({
      ...current,
      [sessionId]: undefined,
    }));
    setTracked((current) =>
      current.map((entry) =>
        entry.sessionId === sessionId
          ? { ...entry, jobId: accepted.jobId }
          : entry,
      ),
    );
  }, []);

  const markSeen = useCallback((sessionId: number) => {
    setUnseenSessionIds((current) => {
      if (!current.has(sessionId)) return current;
      const next = new Set(current);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const entriesForWorkout = useCallback(
    (workoutId: number) =>
      tracked.filter((entry) => entry.workoutId === workoutId),
    [tracked],
  );

  // Re-attach sessions still PROCESSING on the server after an app restart.
  useEffect(() => {
    let isCancelled = false;
    void (async () => {
      try {
        const response = await sessionsApi.listByStatus("PROCESSING");
        if (isCancelled) return;
        for (const session of response.items) {
          if (session.bullmqJobId === null) continue;
          track({
            sessionId: session.id,
            jobId: session.bullmqJobId,
            workoutId: session.workoutId,
            setNumber: session.setNumber,
            exerciseCode: session.exercise.code,
            exerciseDisplayName: session.exercise.displayName,
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
      statusBySession,
      unseenSessionIds,
      track,
      retry,
      markSeen,
      entriesForWorkout,
      toast,
      dismissToast,
    }),
    [
      tracked,
      statusBySession,
      unseenSessionIds,
      track,
      retry,
      markSeen,
      entriesForWorkout,
      toast,
      dismissToast,
    ],
  );

  return (
    <AnalysisTrackerContext.Provider value={value}>
      {children}
      {tracked.map((item) => (
        <AnalysisWatcher
          key={`${item.sessionId}:${item.jobId}`}
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
