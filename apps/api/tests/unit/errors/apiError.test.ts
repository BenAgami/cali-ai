import { StatusCodes } from "http-status-codes";

import ApiError from "../../../src/errors/ApiError";
import BadRequestError from "../../../src/errors/BadRequestError";
import ConflictError from "../../../src/errors/ConflictError";
import ForbiddenError from "../../../src/errors/ForbiddenError";
import InternalError from "../../../src/errors/InternalError";
import NotFoundError from "../../../src/errors/NotFoundError";
import ServiceUnavailableError from "../../../src/errors/ServiceUnavailableError";
import UnauthorizedError from "../../../src/errors/UnauthorizedError";

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
