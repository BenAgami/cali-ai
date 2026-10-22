import { useEffect, useState } from "react";
import EventSource from "react-native-sse";
import StatusCode from "http-status-codes";
import {
  analysisStatusEventSchema,
  type AnalysisStatusEvent,
} from "@repo/common";

import { buildApiUrl } from "@src/api/client";
import { tokenStore } from "@src/api/tokenStore";
import { SESSION_ROUTES } from "@src/constants/routes";

const RECONNECT_INTERVAL_MS = 3_000;
const SESSION_EXPIRED_MESSAGE = "Session expired. Please log in again.";

const parseStatusEvent = (data: string | null): AnalysisStatusEvent | null => {
  if (data === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  const parsed = analysisStatusEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

const isTerminal = (event: AnalysisStatusEvent): boolean =>
  event.status === "COMPLETED" || event.status === "FAILED";

export const useAnalysisStatus = (
  sessionId: number | null,
  runKey: string | null,
) => {
  const [event, setEvent] = useState<AnalysisStatusEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId === null || runKey === null) return;

    let source: EventSource<"status"> | null = null;
    let cancelled = false;
    setEvent(null);
    setError(null);

    void (async () => {
      const token = await tokenStore.getAccessToken();
      if (cancelled) return;

      source = new EventSource<"status">(
        buildApiUrl(SESSION_ROUTES.status(sessionId)),
        {
          headers: { Authorization: `Bearer ${token ?? ""}` },
          pollingInterval: RECONNECT_INTERVAL_MS,
        },
      );

      source.addEventListener("status", (message) => {
        const next = parseStatusEvent(message.data);
        if (next === null) return;
        setEvent((current) => {
          // Keep percent monotonic: drop stale non-terminal events.
          if (
            current !== null &&
            !isTerminal(next) &&
            next.progress_percent < current.progress_percent
          ) {
            return current;
          }
          return next;
        });
        if (isTerminal(next)) source?.close();
      });

      source.addEventListener("error", (message) => {
        if (
          message.type === "error" &&
          message.xhrStatus === StatusCode.UNAUTHORIZED
        ) {
          setError(SESSION_EXPIRED_MESSAGE);
          source?.close();
        }
        // Other errors: react-native-sse reconnects on its own.
      });
    })();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [sessionId, runKey]);

  return { event, error };
};
