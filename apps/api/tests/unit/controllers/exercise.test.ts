import { StatusCodes } from "http-status-codes";
import type { Request } from "express";

import { Role } from "@repo/db";

import ForbiddenError from "../../../src/errors/ForbiddenError";
import exerciseService from "../../../src/services/exerciseService";

import {
  createMockRequest,
  createMockResponse,
  jsonBody,
} from "../helpers/expressMocks";

vi.mock("../../../src/services/exerciseService", () => ({
  default: { listExercises: vi.fn(), getExerciseByCode: vi.fn() },
}));

const { listExercises, getExerciseByCode } =
  await import("../../../src/controllers/exercise");

const serviceResult = { items: [], page: { limit: 20, offset: 0 } };

type ListExercisesQuery = {
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
};

const runListExercises = async (
  query: ListExercisesQuery = {},
  user?: Request["user"],
) => {
  const res = createMockResponse();
  let error: unknown;

  await listExercises(
    createMockRequest({ query: query as Request["query"], user }),
    res,
  ).catch((err: unknown) => {
    error = err;
  });

  return { res, error };
};

const runGetExercise = async (user?: Request["user"]) => {
  const res = createMockResponse();

  const req = createMockRequest({ params: { code: "push_up" }, user });
  await getExerciseByCode(req as Parameters<typeof getExerciseByCode>[0], res);

  return { res };
};

beforeEach(() => {
  vi.mocked(exerciseService.listExercises).mockResolvedValue(
    serviceResult as never,
  );
  vi.mocked(exerciseService.getExerciseByCode).mockResolvedValue({
    id: 1,
  } as never);
});

describe("listExercises", () => {
  it("defaults limit to 20, offset to 0 and includeInactive to false", async () => {
    await runListExercises();

    expect(exerciseService.listExercises).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      includeInactive: false,
    });
  });

  it("passes through limit and offset already coerced by validateSchema", async () => {
    await runListExercises({ limit: 5, offset: 10 });

    expect(exerciseService.listExercises).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, offset: 10 }),
    );
  });

  it("honours includeInactive=true for an admin", async () => {
    const { res } = await runListExercises(
      { includeInactive: true },
      { sub: "uuid-1", role: Role.ADMIN },
    );

    expect(exerciseService.listExercises).toHaveBeenCalledWith(
      expect.objectContaining({ includeInactive: true }),
    );
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
  });

  it.for<[string, Request["user"]]>([
    ["a non-admin user", { sub: "uuid-1", role: Role.USER }],
    ["an anonymous request", undefined],
  ])("rejects includeInactive for %s", async ([_label, user]) => {
    const { error } = await runListExercises({ includeInactive: true }, user);

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(exerciseService.listExercises).not.toHaveBeenCalled();
  });

  it("wraps the service result in the standard success envelope", async () => {
    const { res } = await runListExercises();

    expect(jsonBody(res)).toEqual({
      success: true,
      message: "Exercises retrieved successfully",
      data: serviceResult,
    });
  });
});

describe("getExerciseByCode", () => {
  it("grants inactive exercises to any authenticated user", async () => {
    await runGetExercise({ sub: "uuid-1", role: Role.USER });

    expect(exerciseService.getExerciseByCode).toHaveBeenCalledWith(
      "push_up",
      true,
    );
  });

  it("restricts an anonymous request to active exercises", async () => {
    await runGetExercise();

    expect(exerciseService.getExerciseByCode).toHaveBeenCalledWith(
      "push_up",
      false,
    );
  });

  it("wraps the exercise in the standard success envelope", async () => {
    const { res } = await runGetExercise();

    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(jsonBody(res)).toEqual({
      success: true,
      message: "Exercise retrieved successfully",
      data: { id: 1 },
    });
  });
});
