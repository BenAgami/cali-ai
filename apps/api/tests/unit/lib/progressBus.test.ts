import { EventEmitter } from "node:events";

import type { AnalysisStatusEvent } from "@repo/common";

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  createRedisConnection: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../../src/lib/redis", () => ({
  redisConnection: { publish: mocks.publish },
  createRedisConnection: mocks.createRedisConnection,
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { warn: mocks.warn, error: mocks.error },
}));

class FakeSubscriber extends EventEmitter {
  subscribe = vi.fn().mockResolvedValue(1);
  unsubscribe = vi.fn().mockResolvedValue(1);
  quit = vi.fn().mockResolvedValue("OK");
}

const event = (sessionId: number): AnalysisStatusEvent => ({
  sessionId,
  status: "PROCESSING",
  stage: "ANALYZING_REPS",
  stage_label: "analyzing reps",
  progress_percent: 35,
  failure_reason: null,
});

let subscriber: FakeSubscriber;

const loadBus = () => import("../../../src/lib/progressBus");

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  subscriber = new FakeSubscriber();
  mocks.createRedisConnection.mockImplementation(() => subscriber);
  mocks.publish.mockResolvedValue(1);
});

describe("progress bus", () => {
  it("publishes JSON on the per-session channel", async () => {
    const { publishAnalysisEvent } = await loadBus();

    await publishAnalysisEvent(event(5));

    expect(mocks.publish).toHaveBeenCalledWith(
      "analysis:session:5",
      JSON.stringify(event(5)),
    );
  });

  it("creates one subscriber lazily and reuses it", async () => {
    const { subscribeToAnalysisEvents } = await loadBus();
    expect(mocks.createRedisConnection).not.toHaveBeenCalled();

    await subscribeToAnalysisEvents(1, vi.fn());
    await subscribeToAnalysisEvents(2, vi.fn());

    expect(mocks.createRedisConnection).toHaveBeenCalledTimes(1);
  });

  it("resolves subscribe only after the Redis SUBSCRIBE resolved", async () => {
    let release: () => void = () => undefined;
    subscriber.subscribe.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          release = () => resolve(1);
        }),
    );
    const { subscribeToAnalysisEvents } = await loadBus();
    let isResolved = false;

    const pending = subscribeToAnalysisEvents(1, vi.fn()).then(() => {
      isResolved = true;
    });
    await Promise.resolve();
    expect(isResolved).toBe(false);

    release();
    await pending;
    expect(isResolved).toBe(true);
  });

  it("fans out to two listeners with one Redis SUBSCRIBE and ignores other sessions", async () => {
    const { subscribeToAnalysisEvents } = await loadBus();
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();

    await subscribeToAnalysisEvents(1, first);
    await subscribeToAnalysisEvents(1, second);
    await subscribeToAnalysisEvents(2, other);
    subscriber.emit("message", "analysis:session:1", JSON.stringify(event(1)));

    expect(subscriber.subscribe).toHaveBeenCalledTimes(2);
    expect(first).toHaveBeenCalledWith(event(1));
    expect(second).toHaveBeenCalledWith(event(1));
    expect(other).not.toHaveBeenCalled();
  });

  it("unsubscribes from Redis only when the last listener leaves", async () => {
    const { subscribeToAnalysisEvents } = await loadBus();
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = await subscribeToAnalysisEvents(1, first);
    const offSecond = await subscribeToAnalysisEvents(1, second);

    await offFirst();
    expect(subscriber.unsubscribe).not.toHaveBeenCalled();
    subscriber.emit("message", "analysis:session:1", JSON.stringify(event(1)));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    await offSecond();
    expect(subscriber.unsubscribe).toHaveBeenCalledWith("analysis:session:1");
  });

  it.for([
    ["invalid JSON", "{not json"],
    ["a schema mismatch", JSON.stringify({ sessionId: "x" })],
  ])("drops %s and logs a warning", async ([_label, payload]) => {
    const { subscribeToAnalysisEvents } = await loadBus();
    const listener = vi.fn();
    await subscribeToAnalysisEvents(1, listener);

    subscriber.emit("message", "analysis:session:1", payload);

    expect(listener).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledTimes(1);
  });

  it("keeps fanning out when one listener throws", async () => {
    const { subscribeToAnalysisEvents } = await loadBus();
    const good = vi.fn();
    await subscribeToAnalysisEvents(1, () => {
      throw new Error("boom");
    });
    await subscribeToAnalysisEvents(1, good);

    subscriber.emit("message", "analysis:session:1", JSON.stringify(event(1)));

    expect(good).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledTimes(1);
  });

  it("closeProgressBus quits the subscriber and clears listeners", async () => {
    const { subscribeToAnalysisEvents, closeProgressBus } = await loadBus();
    const listener = vi.fn();
    await subscribeToAnalysisEvents(1, listener);

    await closeProgressBus();
    subscriber.emit("message", "analysis:session:1", JSON.stringify(event(1)));

    expect(subscriber.quit).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it("closeProgressBus is a no-op when nothing subscribed", async () => {
    const { closeProgressBus } = await loadBus();

    await closeProgressBus();

    expect(mocks.createRedisConnection).not.toHaveBeenCalled();
  });
});
