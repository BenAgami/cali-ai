import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

const HEARTBEAT_INTERVAL_MS = 15_000;

export type SseStream = {
  send: (event: string, data: unknown) => void;
  close: () => void;
  onClose: (cb: () => void) => void;
  isClosed: () => boolean;
};

/**
 * Turns a response into a Server-Sent Events stream: writes the SSE headers,
 * flushes them, keeps the connection alive with a heartbeat comment and tears
 * everything down once, whether the server or the client closes first.
 */
export const openSseStream = (req: Request, res: Response): SseStream => {
  res.status(StatusCodes.OK).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  let isClosed = false;
  const closeCallbacks: (() => void)[] = [];

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  const close = (): void => {
    if (isClosed) return;
    isClosed = true;
    clearInterval(heartbeat);
    res.end();
    closeCallbacks.splice(0).forEach((cb) => cb());
  };

  req.on("close", close);

  return {
    send: (event, data) => {
      if (isClosed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close,
    onClose: (cb) => {
      if (isClosed) {
        cb();
        return;
      }
      closeCallbacks.push(cb);
    },
    isClosed: () => isClosed,
  };
};
