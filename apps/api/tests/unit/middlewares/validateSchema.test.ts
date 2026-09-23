import { StatusCodes } from "http-status-codes";
import { z, type ZodType } from "zod";
import type { Request } from "express";

import validateSchema from "../../../src/middlewares/validateSchema";
import { getZodErrorMessage } from "../../../src/utils/zodErrorMessage";

import {
  createMockNext,
  createMockRequest,
  createMockResponse,
  jsonBody,
} from "../helpers/expressMocks";

const run = async (schema: ZodType, reqOverrides: Partial<Request>) => {
  const req = createMockRequest(reqOverrides);
  const res = createMockResponse();
  const next = createMockNext();

  await validateSchema(schema)(req, res, next);

  return { req, res, next };
};

const bodySchema = z.object({ body: z.object({ email: z.email() }) });

describe("validateSchema", () => {
  it("calls next with no arguments when the request is valid", async () => {
    const { res, next } = await run(bodySchema, {
      body: { email: "user@example.com" },
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("validates body, query and params together", async () => {
    const schema = z.object({
      body: z.object({ name: z.string() }),
      query: z.object({ limit: z.string() }),
      params: z.object({ id: z.string() }),
    });

    const valid = await run(schema, {
      body: { name: "push day" },
      query: { limit: "10" },
      params: { id: "7" },
    });
    expect(valid.next).toHaveBeenCalledWith();

    // Dropping any one of the three sources must fail validation.
    const missingParams = await run(schema, {
      body: { name: "push day" },
      query: { limit: "10" },
      params: {},
    });
    expect(missingParams.next).not.toHaveBeenCalled();
    expect(missingParams.res.status).toHaveBeenCalledWith(
      StatusCodes.BAD_REQUEST,
    );
  });

  it("responds 400 with details built by getZodErrorMessage", async () => {
    const { res, next } = await run(bodySchema, { body: { email: "nope" } });

    const expected = getZodErrorMessage(
      bodySchema.safeParse({ body: { email: "nope" }, query: {}, params: {} })
        .error!,
    );

    expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(jsonBody(res)).toEqual({
      success: false,
      message: "Validation Error",
      details: expected,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards a non-ZodError to next and leaves the response untouched", async () => {
    const boom = new Error("schema exploded");
    const throwingSchema = z.custom(() => {
      throw boom;
    });

    const { res, next } = await run(throwingSchema, { body: {} });

    expect(next).toHaveBeenCalledWith(boom);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("assigns the parsed (coerced/transformed) values back onto req.body and req.params", async () => {
    const schema = z.object({
      body: z.object({ name: z.string().trim() }),
      params: z.object({ id: z.coerce.number() }),
    });

    const { req, next } = await run(schema, {
      body: { name: "  push day  " },
      params: { id: "42" },
    });

    expect(req.body).toEqual({ name: "push day" });
    expect(req.params).toEqual({ id: 42 });
    expect(next).toHaveBeenCalledWith();
  });

  it("overwrites req.query even when it is a getter-only accessor, as in Express 5", async () => {
    const schema = z.object({ query: z.object({ limit: z.coerce.number() }) });
    const res = createMockResponse();
    const next = createMockNext();

    const req = { body: {}, params: {} } as Request;
    Object.defineProperty(req, "query", {
      configurable: true,
      enumerable: true,
      get: () => ({ limit: "5" }),
    });

    await validateSchema(schema)(req, res, next);

    expect(req.query).toEqual({ limit: 5 });
    expect(next).toHaveBeenCalledWith();
  });

  it("leaves req.body and req.query untouched when the schema only validates params", async () => {
    const schema = z.object({ params: z.object({ id: z.string() }) });
    const originalBody = { untouched: true };
    const originalQuery = { untouched: "true" };

    const { req, next } = await run(schema, {
      body: originalBody,
      query: originalQuery,
      params: { id: "7" },
    });

    expect(req.body).toBe(originalBody);
    expect(req.query).toBe(originalQuery);
    expect(next).toHaveBeenCalledWith();
  });
});
