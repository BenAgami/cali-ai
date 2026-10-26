import { NextFunction, Request, Response } from "express";
import { finished } from "node:stream";

import { PayloadTooLargeError } from "../errors";

/**
 * Rejects requests whose declared Content-Length exceeds `maxBytes`.
 *
 * This checks the COMPRESSED size (D-04) without parsing the body. The inflated
 * size is bounded separately: by the global `express.json({ limit: "10mb" })`
 * for JSON bodies and by `gunzipCaptureBody` for gzip bodies.
 *
 * The unread body is drained before the error goes out. Raw `application/gzip`
 * bodies are not consumed by the global JSON parser, and answering while the
 * client is still uploading resets the connection instead of delivering the
 * 413 (body-parser waits for the request to end for the same reason).
 */
const rejectOversizedBody =
  (maxBytes: number) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > maxBytes) {
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
