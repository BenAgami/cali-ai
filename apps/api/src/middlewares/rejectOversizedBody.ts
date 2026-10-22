import { NextFunction, Request, Response } from "express";

import { PayloadTooLargeError } from "../errors";

/**
 * Rejects requests whose declared Content-Length exceeds `maxBytes`.
 *
 * This checks the COMPRESSED size (D-04). The global
 * `express.json({ limit: "10mb" })` in app.ts runs first and already bounds
 * the inflated size (gzip-bomb protection), so this middleware only enforces
 * the tighter compressed cap without re-parsing the body.
 */
const rejectOversizedBody =
  (maxBytes: number) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > maxBytes) {
      next(new PayloadTooLargeError(`Request body exceeds ${maxBytes} bytes`));
      return;
    }
    next();
  };

export default rejectOversizedBody;
