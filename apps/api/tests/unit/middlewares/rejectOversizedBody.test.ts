import { Readable } from "node:stream";
import { StatusCodes } from "http-status-codes";
import type { Request } from "express";

import rejectOversizedBody from "../../../src/middlewares/rejectOversizedBody";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMocks";

const MAX_BYTES = 1_048_576;

const run = (contentLength?: string) => {
  const headers =
    contentLength === undefined ? {} : { "content-length": contentLength };
  const req = Object.assign(
    Readable.from([Buffer.from("body")]),
    createMockRequest({ headers }),
  ) as unknown as Request;
  const next = createMockNext();

  rejectOversizedBody(MAX_BYTES)(req, createMockResponse(), next);

  return { next, req };
};

describe("rejectOversizedBody", () => {
  it("drains the body, then rejects a declared length above the cap with 413", async () => {
    const { next, req } = run(String(MAX_BYTES + 1));

    expect(next).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
    expect(req.readableEnded).toBe(true);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: StatusCodes.REQUEST_TOO_LONG }),
    );
  });

  it("accepts a declared length exactly at the cap", () => {
    expect(run(String(MAX_BYTES)).next).toHaveBeenCalledWith();
  });

  it("accepts a request with no content-length header", () => {
    expect(run().next).toHaveBeenCalledWith();
  });

  it("accepts a non-numeric content-length header", () => {
    expect(run("abc").next).toHaveBeenCalledWith();
  });
});
