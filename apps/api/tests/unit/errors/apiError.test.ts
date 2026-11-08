import { StatusCodes } from "http-status-codes";

import {
  ApiError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  PreconditionRequiredError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../../../src/errors";

type Subclass = new (message?: string) => ApiError;

const subclasses: [
  name: string,
  Ctor: Subclass,
  status: number,
  message: string,
][] = [
  ["BadRequestError", BadRequestError, StatusCodes.BAD_REQUEST, "Bad Request"],
  [
    "UnauthorizedError",
    UnauthorizedError,
    StatusCodes.UNAUTHORIZED,
    "Unauthorized",
  ],
  ["ForbiddenError", ForbiddenError, StatusCodes.FORBIDDEN, "Forbidden"],
  ["NotFoundError", NotFoundError, StatusCodes.NOT_FOUND, "Not Found"],
  ["ConflictError", ConflictError, StatusCodes.CONFLICT, "Conflict"],
  [
    "InternalError",
    InternalError,
    StatusCodes.INTERNAL_SERVER_ERROR,
    "Internal Server Error",
  ],
  [
    "ServiceUnavailableError",
    ServiceUnavailableError,
    StatusCodes.SERVICE_UNAVAILABLE,
    "Service Unavailable",
  ],
];

describe("ApiError", () => {
  it("defaults to a 500 status", () => {
    const error = new ApiError("boom");

    expect(error.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it("assigns status and statusCode from the constructor argument", () => {
    const error = new ApiError("teapot", 418);

    expect(error.status).toBe(418);
    expect(error.statusCode).toBe(418);
  });

  it("exposes the message and a stack trace", () => {
    const error = new ApiError("boom");

    expect(error.message).toBe("boom");
    expect(typeof error.stack).toBe("string");
    expect(error.stack).toContain("boom");
  });

  it("reports its own class name", () => {
    expect(new ApiError("boom").name).toBe("ApiError");
  });
});

describe.for(subclasses)("%s", ([name, Ctor, status, defaultMessage]) => {
  it("uses its default message and status", () => {
    const error = new Ctor();

    expect(error.message).toBe(defaultMessage);
    expect(error.status).toBe(status);
  });

  it("accepts a custom message without changing the status", () => {
    const error = new Ctor("custom message");

    expect(error.message).toBe("custom message");
    expect(error.status).toBe(status);
  });

  it("keeps status and statusCode in sync", () => {
    const error = new Ctor();

    expect(error.status).toBe(error.statusCode);
  });

  it("is an instance of its own class, ApiError and Error", () => {
    const error = new Ctor();

    expect(error).toBeInstanceOf(Ctor);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
  });

  it("reports its own class name", () => {
    expect(new Ctor().name).toBe(name);
  });
});

describe("ApiError codes", () => {
  it("leaves code undefined by default", () => {
    expect(new ApiError("x").code).toBeUndefined();
    expect(new ConflictError().code).toBeUndefined();
  });

  it("PreconditionRequiredError carries status 428 and code", () => {
    const error = new PreconditionRequiredError("msg", "BODY_METRICS_REQUIRED");
    expect(error.status).toBe(StatusCodes.PRECONDITION_REQUIRED);
    expect(error.statusCode).toBe(StatusCodes.PRECONDITION_REQUIRED);
    expect(error.code).toBe("BODY_METRICS_REQUIRED");
    expect(error.name).toBe("PreconditionRequiredError");
    expect(error).toBeInstanceOf(ApiError);
  });

  it("TooManyRequestsError carries status 429 and code", () => {
    const error = new TooManyRequestsError("msg", "DAILY_LIMIT_REACHED");
    expect(error.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
    expect(error.code).toBe("DAILY_LIMIT_REACHED");
  });

  it("ConflictError and ServiceUnavailableError forward code", () => {
    expect(new ConflictError("msg", "GENERATION_IN_PROGRESS").code).toBe(
      "GENERATION_IN_PROGRESS",
    );
    expect(new ServiceUnavailableError("msg", "GENERATION_FAILED").code).toBe(
      "GENERATION_FAILED",
    );
  });
});
