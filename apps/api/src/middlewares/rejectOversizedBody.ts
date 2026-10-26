import { NextFunction, Request, Response } from "express";
import { finished } from "node:stream";

import { PayloadTooLargeError } from "../errors";

/**
 * Rejects requests whose declared Content-Length exceeds `maxBytes`. This caps
 * the compressed size only; inflated size is bounded by the global JSON limit
 * for JSON bodies and by `gunzipCaptureBody` for gzip bodies.
 *
 * The unread body is drained before responding, otherwise answering mid-upload
 * resets the connection and the client never sees the 413.
 */
const rejectOversizedBody =
  (maxBytes: number) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const declaredBytes = Number(req.headers["content-length"]);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      finished(req, () =>
        next(
          new PayloadTooLargeError(`Request body exceeds ${maxBytes} bytes`),
        ),
      );
      req.resume();
      return;
    }
    next();
  };

export default rejectOversizedBody;
