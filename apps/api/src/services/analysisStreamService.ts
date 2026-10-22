import { SessionStatus } from "@repo/db";
import type { AnalysisStatusEvent } from "@repo/common";

import { ConflictError } from "../errors";
import { logger } from "../lib/logger";
import { subscribeToAnalysisEvents } from "../lib/progressBus";
import analysisStateService from "./analysisStateService";
import { toError } from "../utils/toError";

export type AnalysisStreamSink = {
  send: (event: AnalysisStatusEvent) => void;
  close: () => void;
  onClose: (cb: () => void) => void;
};

class AnalysisStreamService {
  /** Throws before any stream is opened, so 404/409 go through the error handler. */
  async assertStreamable(userUuid: string, sessionId: number): Promise<void> {
    const session = await analysisStateService.findOwnedSession(
      userUuid,
      sessionId,
    );

    if (session.processingStatus === SessionStatus.PENDING) {
      throw new ConflictError("No analysis has been started for this session");
    }
  }

  /**
   * Pumps status events into an already-open sink. Never rejects: once headers
   * are flushed the HTTP error handler cannot change the response, so failures
   * are logged and the sink is closed (the one documented post-flush catch).
   */
  async attach(sessionId: number, sink: AnalysisStreamSink): Promise<void> {
    let lastPercent = -1;

    const emit = (event: AnalysisStatusEvent): void => {
      const terminal =
        event.status === "COMPLETED" || event.status === "FAILED";
      if (!terminal && event.progress_percent < lastPercent) return;

      lastPercent = Math.max(lastPercent, event.progress_percent);
      sink.send(event);
      if (terminal) sink.close();
    };

    try {
      // Subscribe first so events published before the snapshot read are kept.
      const unsubscribe = await subscribeToAnalysisEvents(sessionId, emit);
      sink.onClose(() => {
        unsubscribe().catch((error: unknown) => {
          logger.warn(
            { err: toError(error), sessionId },
            "Failed to unsubscribe analysis stream",
          );
        });
      });

      const current = await analysisStateService.getStatusEvent(sessionId);
      if (current) emit(current);
    } catch (error) {
      logger.error(
        { err: toError(error), sessionId },
        "Failed to attach analysis status stream",
      );
      sink.close();
    }
  }
}

export const analysisStreamService = new AnalysisStreamService();
