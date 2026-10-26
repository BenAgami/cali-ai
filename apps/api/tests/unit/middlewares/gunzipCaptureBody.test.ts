import { gzipSync } from "node:zlib";
import { StatusCodes } from "http-status-codes";

import gunzipCaptureBody from "../../../src/middlewares/gunzipCaptureBody";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../helpers/expressMocks";

const MAX_INFLATED = 1_024;

const run = async (body: unknown) => {
  const req = createMockRequest({ body });
  const next = createMockNext();

  await gunzipCaptureBody(MAX_INFLATED)(req, createMockResponse(), next);

  return { req, next };
};

describe("gunzipCaptureBody", () => {
  it("replaces a raw gzip body with the parsed JSON object", async () => {
    const { req, next } = await run(
      gzipSync(Buffer.from(JSON.stringify({ hello: "world" }))),
    );

    expect(req.body).toEqual({ hello: "world" });
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("leaves an already parsed JSON body untouched", async () => {
    const parsed = { hello: "world" };

    const { req, next } = await run(parsed);

    expect(req.body).toBe(parsed);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects bytes that are not gzip with 400", async () => {
    const { next } = await run(Buffer.from("not gzip"));

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: StatusCodes.BAD_REQUEST,
        message: "Request body is not valid gzip",
      }),
    );
  });

  it("rejects gzip that does not contain JSON with 400", async () => {
    const { next } = await run(gzipSync(Buffer.from("not json")));

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: StatusCodes.BAD_REQUEST,
        message: "Decompressed body is not valid JSON",
      }),
    );
  });

  it("rejects a body that inflates past the cap with 413", async () => {
    const { next } = await run(gzipSync(Buffer.alloc(MAX_INFLATED + 1)));

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: StatusCodes.REQUEST_TOO_LONG }),
    );
  });
});
