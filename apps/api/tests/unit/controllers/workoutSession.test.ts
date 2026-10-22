import { StatusCodes } from "http-status-codes";
import type { Request } from "express";

import { Role } from "@repo/db";

import workoutSessionService from "../../../src/services/workoutSessionService";

import {
  createMockRequest,
  createMockResponse,
  jsonBody,
} from "../helpers/expressMocks";

vi.mock("../../../src/services/workoutSessionService", () => ({
  default: { createSession: vi.fn(), listSessions: vi.fn() },
}));

const { createWorkoutSession, listWorkoutSessions } =
  await import("../../../src/controllers/workoutSession");

const USER: Request["user"] = { sub: "uuid-1", role: Role.USER };

const runCreateWorkoutSession = async (user: Request["user"] | undefined) => {
  const res = createMockResponse();

  await createWorkoutSession(
    createMockRequest({ body: { exerciseCode: "push_up" }, user }),
    res,
  );

  return { res, body: jsonBody(res) as { data?: Record<string, unknown> } };
};

const runListWorkoutSessions = async (
  query: { limit?: number; offset?: number; exerciseCode?: string } = {},
) => {
  const res = createMockResponse();

  await listWorkoutSessions(
    createMockRequest({ query: query as Request["query"], user: USER }),
    res,
  );

  return { res, body: jsonBody(res) as { data: { items: unknown[] } } };
};

describe("createWorkoutSession", () => {
  it("responds 401 and never reaches the service when unauthenticated", async () => {
    const { res } = await runCreateWorkoutSession(undefined);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(workoutSessionService.createSession).not.toHaveBeenCalled();
  });

  it("passes the service result through untouched", async () => {
    const serviceResult = { id: 1, processingStatus: "PENDING" };
    vi.mocked(workoutSessionService.createSession).mockResolvedValue(
      serviceResult as never,
    );

    const { body } = await runCreateWorkoutSession(USER);

    expect(body.data).toEqual(serviceResult);
  });

  it("responds 201 with the standard success envelope", async () => {
    vi.mocked(workoutSessionService.createSession).mockResolvedValue({
      id: 1,
    } as never);

    const { res, body } = await runCreateWorkoutSession(USER);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    expect(body).toMatchObject({
      success: true,
      message: "Workout session created successfully",
    });
  });
});

describe("listWorkoutSessions", () => {
  const page = { limit: 20, offset: 0, hasMore: false, nextOffset: null };
  const listResult = {
    items: [
      { id: 1, processingStatus: "PENDING" },
      { id: 2, processingStatus: "COMPLETED" },
    ],
    page,
  };

  beforeEach(() => {
    vi.mocked(workoutSessionService.listSessions).mockResolvedValue(
      listResult as never,
    );
  });

  it("passes the service result through untouched", async () => {
    const { body } = await runListWorkoutSessions();

    expect(body.data).toEqual(listResult);
  });

  it("defaults limit to 20 and offset to 0", async () => {
    await runListWorkoutSessions();

    expect(workoutSessionService.listSessions).toHaveBeenCalledWith({
      userUuid: "uuid-1",
      limit: 20,
      offset: 0,
      exerciseCode: undefined,
    });
  });

  it("forwards limit, offset and exerciseCode from the query", async () => {
    await runListWorkoutSessions({
      limit: 5,
      offset: 10,
      exerciseCode: "PUSH_UP",
    });

    expect(workoutSessionService.listSessions).toHaveBeenCalledWith({
      userUuid: "uuid-1",
      limit: 5,
      offset: 10,
      exerciseCode: "PUSH_UP",
    });
  });
});
