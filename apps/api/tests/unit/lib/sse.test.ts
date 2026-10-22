import { EventEmitter } from "node:events";
import type { Request } from "express";

import { openSseStream } from "../../../src/lib/sse";

import { createMockResponse } from "../helpers/expressMocks";

const setup = () => {
  const res = Object.assign(createMockResponse(), {
    set: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  });
  res.set.mockReturnValue(res);
  const req = new EventEmitter() as unknown as Request;
  const stream = openSseStream(req, res);
  return { req, res, stream };
};

describe("openSseStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets SSE headers and flushes them", () => {
    const { res } = setup();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.set).toHaveBeenCalledWith({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    expect(res.flushHeaders).toHaveBeenCalledOnce();
  });

  it("writes events in SSE wire format", () => {
    const { res, stream } = setup();

    stream.send("status", { a: 1 });

    expect(res.write).toHaveBeenCalledWith(
      'event: status\ndata: {"a":1}\n\n',
    );
  });

  it("writes a heartbeat every 15 seconds and stops after close", () => {
    const { res, stream } = setup();

    vi.advanceTimersByTime(15_000);
    expect(res.write).toHaveBeenCalledTimes(1);
    expect(res.write).toHaveBeenLastCalledWith(": ping\n\n");

    vi.advanceTimersByTime(15_000);
    expect(res.write).toHaveBeenCalledTimes(2);

    stream.close();
    vi.advanceTimersByTime(60_000);
    expect(res.write).toHaveBeenCalledTimes(2);
  });

  it("ends the response and runs onClose callbacks once", () => {
    const { res, stream } = setup();
    const cb = vi.fn();
    stream.onClose(cb);

    stream.close();
    stream.close();

    expect(res.end).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledOnce();
    expect(stream.isClosed()).toBe(true);
  });

  it("ignores send after close", () => {
    const { res, stream } = setup();
    stream.close();

    stream.send("status", { a: 1 });

    expect(res.write).not.toHaveBeenCalled();
  });

  it("closes when the request emits close", () => {
    const { req, res, stream } = setup();
    const cb = vi.fn();
    stream.onClose(cb);

    req.emit("close");

    expect(stream.isClosed()).toBe(true);
    expect(res.end).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("runs an onClose callback registered after close immediately", () => {
    const { stream } = setup();
    stream.close();
    const cb = vi.fn();

    stream.onClose(cb);

    expect(cb).toHaveBeenCalledOnce();
  });
});
