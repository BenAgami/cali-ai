import { ProcessingStatus } from "@repo/db";
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
  async assertStreamable(
    userUuid: string,
    recordedSetId: number,
  ): Promise<void> {
    const recordedSet = await analysisStateService.findOwnedRecordedSet(
      userUuid,
      recordedSetId,
    );

    if (recordedSet.processingStatus === ProcessingStatus.PENDING) {
      throw new ConflictError(
        "No analysis has been started for this recorded set",
      );
    }
  }

  /**
   * Streams progress events to an already-open sink until a terminal event or
   * client disconnect. Never rejects: the response is already flushed, so the
   * error handler can't change it. Failures are logged and the sink is closed.
   */
  async streamProgressToSink(
    recordedSetId: number,
    sink: AnalysisStreamSink,
  ): Promise<void> {
    let lastPercent = -1;

    const emit = (event: AnalysisStatusEvent): void => {
      const isTerminalStatus =
        event.status === "COMPLETED" || event.status === "FAILED";
      if (!isTerminalStatus && event.progress_percent < lastPercent) return;

      lastPercent = Math.max(lastPercent, event.progress_percent);
      sink.send(event);
      if (isTerminalStatus) sink.close();
    };

    try {
      const unsubscribe = await subscribeToAnalysisEvents(recordedSetId, emit);
      sink.onClose(() => {
        unsubscribe().catch((error: unknown) => {
          logger.warn(
            { err: toError(error), recordedSetId },
            "Failed to unsubscribe analysis stream",
          );
        });
      });

      const current = await analysisStateService.getStatusEvent(recordedSetId);
      if (current) emit(current);
    } catch (error) {
      logger.error(
        { err: toError(error), recordedSetId },
        "Failed to stream analysis progress",
      );
      sink.close();
    }
  }
}

export default new AnalysisStreamService();
