import { StatusCodes } from "http-status-codes";

import NotFoundError from "../../../src/errors/NotFoundError";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
  jsonBody,
} from "../helpers/expressMocks";

const mockEnv = { runtimeEnv: "test" as string };

vi.mock("../../../src/config/env", () => ({ env: mockEnv }));
vi.mock("../../../src/lib/logger", () => ({
  logger: { error: vi.fn(), debug: vi.fn() },
}));

const { default: errorHandler } =
  await import("../../../src/middlewares/errorHandler");
const { logger } = await import("../../../src/lib/logger");

const run = (error: unknown) => {
  const req = createMockRequest({ method: "POST", originalUrl: "/api/things" });
  const res = createMockResponse();

  errorHandler(error, req, res, createMockNext());

  return { res, body: jsonBody(res) as Record<string, unknown> };
};

beforeEach(() => {
  mockEnv.runtimeEnv = "test";
});

describe("errorHandler", () => {
  describe("status and body", () => {
    it("uses the error's status and message for a client error", () => {
      const { res, body } = run(new NotFoundError("nope"));

      expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(body).toMatchObject({
        success: false,
        message: "nope",
        code: "INTERNAL_ERROR",
      });
    });

    it("uses a string code from the error", () => {
      expect(run({ status: 400, code: "CUSTOM_CODE" }).body.code).toBe(
        "CUSTOM_CODE",
      );
    });

    it("falls back to INTERNAL_ERROR when code is not a string", () => {
      expect(run({ status: 400, code: 500 }).body.code).toBe("INTERNAL_ERROR");
    });

    it("defaults to 500 when the error carries no numeric status", () => {
      const { res } = run(new Error("bare"));

      expect(res.status).toHaveBeenCalledWith(
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    });

    it("masks the message of a 5xx error", () => {
      expect(run(new Error("connection string leaked")).body.message).toBe(
        "Internal Server Error",
      );
    });

    it("masks the message of a non-Error value even below 500", () => {
      expect(run({ status: 400, message: "plain object" }).body.message).toBe(
        "Internal Server Error",
      );
    });
  });

  describe("logging", () => {
    it("logs 5xx at error level and not at debug level", () => {
      const error = new Error("boom");
      run(error);

      expect(logger.error).toHaveBeenCalledWith(
        { err: error, method: "POST", url: "/api/things" },
        "Unhandled server error",
      );
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it("logs 4xx at debug level outside production", () => {
      run(new NotFoundError("nope"));

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ method: "POST", url: "/api/things" }),
        "Request error",
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("does not log 4xx in production", () => {
      mockEnv.runtimeEnv = "production";
      run(new NotFoundError("nope"));

      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("still logs 5xx in production", () => {
      mockEnv.runtimeEnv = "production";
      run(new Error("boom"));

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("stack details", () => {
    it("includes the stack outside production", () => {
      const error = new NotFoundError("nope");

      expect(run(error).body.details).toBe(error.stack);
    });

    it("omits the stack in production", () => {
      mockEnv.runtimeEnv = "production";

      expect(run(new NotFoundError("nope"))).not.toHaveProperty("body.details");
    });

    it("omits the stack for a non-Error value outside production", () => {
      expect(run({ status: 400 }).body).not.toHaveProperty("details");
    });
  });
});
