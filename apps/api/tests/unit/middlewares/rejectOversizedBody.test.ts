import { StatusCodes } from "http-status-codes";

import rejectOversizedBody from "../../../src/middlewares/rejectOversizedBody";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMocks";

const MAX = 1_048_576;

const run = (contentLength?: string) => {
  const req = createMockRequest({
    headers:
      contentLength === undefined ? {} : { "content-length": contentLength },
  });
  const next = createMockNext();
  rejectOversizedBody(MAX)(req, createMockResponse(), next);
  return next;
};

describe("rejectOversizedBody", () => {
  it("rejects a declared length above the cap with 413", () => {
    const next = run(String(MAX + 1));

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: StatusCodes.REQUEST_TOO_LONG }),
    );
  });

  it("accepts a declared length exactly at the cap", () => {
    expect(run(String(MAX))).toHaveBeenCalledWith();
  });

  it("accepts a request with no content-length header", () => {
    expect(run()).toHaveBeenCalledWith();
  });

  it("accepts a non-numeric content-length header", () => {
    expect(run("abc")).toHaveBeenCalledWith();
  });
});
