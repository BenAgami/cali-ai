import { SessionStatus } from "@repo/db";
import type { AnalysisStatusEvent } from "@repo/common";

import { ConflictError, NotFoundError } from "../../../src/errors";
import analysisStateService from "../../../src/services/analysisStateService";
import { subscribeToAnalysisEvents } from "../../../src/lib/progressBus";
import { logger } from "../../../src/lib/logger";
import { analysisStreamService } from "../../../src/services/analysisStreamService";

vi.mock("../../../src/services/analysisStateService", () => ({
  default: { findOwnedSession: vi.fn(), getStatusEvent: vi.fn() },
}));
vi.mock("../../../src/lib/progressBus", () => ({
  subscribeToAnalysisEvents: vi.fn(),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

const event = (
  overrides: Partial<AnalysisStatusEvent> = {},
): AnalysisStatusEvent => ({
  sessionId: 7,
  status: "PROCESSING",
  stage: "ANALYZING_REPS",
  stage_label: "Analyzing reps",
  progress_percent: 50,
  failure_reason: null,
  ...overrides,
});

const createSink = () => {
  const callbacks: (() => void)[] = [];
  let closed = false;
  const sink = {
    send: vi.fn(),
    close: vi.fn(() => {
      if (closed) return;
      closed = true;
      callbacks.forEach((cb) => cb());
    }),
    onClose: vi.fn((cb: () => void) => {
      callbacks.push(cb);
    }),
  };
  return sink;
};

describe("analysisStreamService", () => {
  let listener: (e: AnalysisStatusEvent) => void;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribe.mockResolvedValue(undefined);
    vi.mocked(subscribeToAnalysisEvents).mockImplementation((_id, l) => {
      listener = l;
      return Promise.resolve(unsubscribe);
    });
  });

  describe("assertStreamable", () => {
    const snapshot = (processingStatus: SessionStatus) => ({
      id: 7,
      processingStatus,
      analysisStage: null,
      analysisStageProgress: null,
      failureReason: null,
      bullmqJobId: null,
    });

    it("propagates NotFoundError from the ownership lookup", async () => {
      vi.mocked(analysisStateService.findOwnedSession).mockRejectedValue(
        new NotFoundError("Workout session not found"),
      );

      await expect(
        analysisStreamService.assertStreamable("u", 7),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rejects a PENDING session with ConflictError", async () => {
      vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
        snapshot(SessionStatus.PENDING),
      );

      const promise = analysisStreamService.assertStreamable("u", 7);

      await expect(promise).rejects.toBeInstanceOf(ConflictError);
      await expect(promise).rejects.toThrow(
        "No analysis has been started for this session",
      );
    });

    it.each([
      SessionStatus.PROCESSING,
      SessionStatus.COMPLETED,
      SessionStatus.FAILED,
    ])("resolves for a %s session", async (status) => {
      vi.mocked(analysisStateService.findOwnedSession).mockResolvedValue(
        snapshot(status),
      );

      await expect(
        analysisStreamService.assertStreamable("u", 7),
      ).resolves.toBeUndefined();
    });
  });

  describe("attach", () => {
    it("subscribes before reading the snapshot", async () => {
      vi.mocked(analysisStateService.getStatusEvent).mockResolvedValue(
        event(),
      );

      await analysisStreamService.attach(7, createSink());

      const subscribeOrder = vi.mocked(subscribeToAnalysisEvents).mock
        .invocationCallOrder[0];
      const readOrder = vi.mocked(analysisStateService.getStatusEvent).mock
        .invocationCallOrder[0];
      expect(subscribeOrder).toBeLessThan(readOrder);
    });

    it("sends a terminal current state once, closes and unsubscribes", async () => {
      const completed = event({
        status: "COMPLETED",
        stage: "COMPLETED",
        progress_percent: 100,
      });
      vi.mocked(analysisStateService.getStatusEvent).mockResolvedValue(
        completed,
      );
      const sink = createSink();

      await analysisStreamService.attach(7, sink);

      expect(sink.send).toHaveBeenCalledOnce();
      expect(sink.send).toHaveBeenCalledWith(completed);
      expect(sink.close).toHaveBeenCalled();
      expect(unsubscribe).toHaveBeenCalledOnce();
    });

    it("drops a lower non-terminal live event but always sends terminal ones", async () => {
      vi.mocked(analysisStateService.getStatusEvent).mockResolvedValue(
        event({ progress_percent: 50 }),
      );
      const sink = createSink();
      await analysisStreamService.attach(7, sink);

      listener(event({ progress_percent: 20 }));
      expect(sink.send).toHaveBeenCalledTimes(1);

      listener(event({ progress_percent: 70 }));
      expect(sink.send).toHaveBeenCalledTimes(2);

      const failed = event({
        status: "FAILED",
        progress_percent: 10,
        failure_reason: "TIMEOUT",
      });
      listener(failed);
      expect(sink.send).toHaveBeenLastCalledWith(failed);
      expect(sink.close).toHaveBeenCalled();
    });

    it("sends nothing from the snapshot when the session is gone", async () => {
      vi.mocked(analysisStateService.getStatusEvent).mockResolvedValue(null);
      const sink = createSink();

      await analysisStreamService.attach(7, sink);

      expect(sink.send).not.toHaveBeenCalled();
      expect(sink.close).not.toHaveBeenCalled();
    });

    it("logs and closes when the snapshot read rejects", async () => {
      const failure = new Error("db down");
      vi.mocked(analysisStateService.getStatusEvent).mockRejectedValue(
        failure,
      );
      const sink = createSink();

      await expect(
        analysisStreamService.attach(7, sink),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        { err: failure, sessionId: 7 },
        expect.any(String),
      );
      expect(sink.close).toHaveBeenCalled();
    });

    it("logs and closes when subscribing rejects, without reading", async () => {
      const failure = new Error("redis down");
      vi.mocked(subscribeToAnalysisEvents).mockRejectedValue(failure);
      const sink = createSink();

      await expect(
        analysisStreamService.attach(7, sink),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        { err: failure, sessionId: 7 },
        expect.any(String),
      );
      expect(sink.close).toHaveBeenCalled();
      expect(analysisStateService.getStatusEvent).not.toHaveBeenCalled();
    });

    it("warns when unsubscribing rejects on close", async () => {
      const failure = new Error("unsub failed");
      unsubscribe.mockRejectedValue(failure);
      vi.mocked(analysisStateService.getStatusEvent).mockResolvedValue(
        event({ status: "COMPLETED", progress_percent: 100 }),
      );

      await analysisStreamService.attach(7, createSink());
      await Promise.resolve();
      await Promise.resolve();

      expect(logger.warn).toHaveBeenCalledWith(
        { err: failure, sessionId: 7 },
        expect.any(String),
      );
    });
  });
});
