import type { NextFunction, Request, Response } from "express";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

import { BadRequestError, PayloadTooLargeError } from "../errors";

const gunzipAsync = promisify(gunzip);

/**
 * Turns a raw `application/gzip` body into the parsed JSON that
 * `validateSchema` expects.
 *
 * The inflated size is capped here (gzip-bomb protection) since the global
 * JSON limit doesn't apply to raw bodies.
 */
const gunzipCaptureBody =
  (maxInflatedBytes: number) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!Buffer.isBuffer(req.body)) {
      next(new BadRequestError("Capture body must be application/gzip"));
      return;
    }

    let inflated: Buffer;
    try {
      inflated = await gunzipAsync(req.body, {
        maxOutputLength: maxInflatedBytes,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") {
        next(
          new PayloadTooLargeError(
            `Decompressed body exceeds ${maxInflatedBytes} bytes`,
          ),
        );
        return;
      }
      next(new BadRequestError("Request body is not valid gzip"));
      return;
    }

    try {
      req.body = JSON.parse(inflated.toString("utf8")) as unknown;
    } catch {
      next(new BadRequestError("Decompressed body is not valid JSON"));
      return;
    }
    next();
  };

export default gunzipCaptureBody;
