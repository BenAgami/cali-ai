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

  it("converts a bigint videoSizeBytes into a JSON-serializable number", async () => {
    vi.mocked(workoutSessionService.createSession).mockResolvedValue({
      id: 1,
      videoSizeBytes: 1234n,
    } as never);

    const { body } = await runCreateWorkoutSession(USER);

    expect(body.data?.videoSizeBytes).toBe(1234);
    expect(typeof body.data?.videoSizeBytes).toBe("number");
    expect(() => JSON.stringify(body)).not.toThrow();
  });

  it.for([
    ["null", { id: 1, videoSizeBytes: null }],
    ["absent", { id: 1 }],
  ])("normalizes a %s videoSizeBytes to null", async ([_label, session]) => {
    vi.mocked(workoutSessionService.createSession).mockResolvedValue(
      session as never,
    );

    const { body } = await runCreateWorkoutSession(USER);

    expect(body.data?.videoSizeBytes).toBeNull();
  });

  it("responds 201 with the standard success envelope", async () => {
    vi.mocked(workoutSessionService.createSession).mockResolvedValue({
      id: 1,
      videoSizeBytes: null,
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

  beforeEach(() => {
    vi.mocked(workoutSessionService.listSessions).mockResolvedValue({
      items: [
        { id: 1, videoSizeBytes: 5000n },
        { id: 2, videoSizeBytes: null },
        { id: 3 },
      ],
      page,
    } as never);
  });

  it("serializes every item and passes the page metadata through untouched", async () => {
    const { body } = await runListWorkoutSessions();

    expect(body.data.items).toEqual([
      { id: 1, videoSizeBytes: 5000 },
      { id: 2, videoSizeBytes: null },
      { id: 3, videoSizeBytes: null },
    ]);
    expect(body.data).toMatchObject({ page });
    expect(() => JSON.stringify(body)).not.toThrow();
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
