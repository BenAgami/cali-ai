import { NextFunction, Request, Response } from "express";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

import { BadRequestError, PayloadTooLargeError } from "../errors";

const gunzipAsync = promisify(gunzip);

/**
 * Turns a raw `application/gzip` body into the parsed JSON object that
 * `validateSchema` expects.
 *
 * The phone sends the capture as a gzip file instead of relying on
 * `Content-Encoding: gzip`, which never reached the server from the Android
 * dev build (the global `express.json()` then saw gzip bytes and failed).
 * Bodies the global JSON parser already parsed pass through untouched.
 *
 * The inflated size is capped here because the 10 MB `express.json()` limit
 * does not apply to raw bodies (gzip-bomb protection).
 */
const gunzipCaptureBody =
  (maxInflatedBytes: number) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!Buffer.isBuffer(req.body)) {
      next();
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
