import { StatusCodes } from "http-status-codes";
import type { Request } from "express";

import { Role } from "@repo/db";

import recordedSetService from "../../../src/services/recordedSetService";

import {
  createMockRequest,
  createMockResponse,
  jsonBody,
} from "../helpers/expressMocks";

vi.mock("../../../src/services/recordedSetService", () => ({
  default: { createRecordedSet: vi.fn(), listRecordedSets: vi.fn() },
}));

const { createRecordedSet, listRecordedSets } =
  await import("../../../src/controllers/recordedSet");

const USER: Request["user"] = { sub: "uuid-1", role: Role.USER };

const runCreateRecordedSet = async (user: Request["user"] | undefined) => {
  const res = createMockResponse();

  await createRecordedSet(
    createMockRequest({ body: { exerciseCode: "push_up" }, user }),
    res,
  );

  return { res, body: jsonBody(res) as { data?: Record<string, unknown> } };
};

const runListRecordedSets = async (
  query: {
    limit?: number;
    offset?: number;
    exerciseCode?: string;
    processingStatus?: string;
  } = {},
) => {
  const res = createMockResponse();

  await listRecordedSets(
    createMockRequest({ query: query as Request["query"], user: USER }),
    res,
  );

  return { res, body: jsonBody(res) as { data: { items: unknown[] } } };
};

describe("createRecordedSet", () => {
  it("responds 401 and never reaches the service when unauthenticated", async () => {
    const { res } = await runCreateRecordedSet(undefined);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(recordedSetService.createRecordedSet).not.toHaveBeenCalled();
  });

  it("responds 201 with the standard success envelope", async () => {
    vi.mocked(recordedSetService.createRecordedSet).mockResolvedValue({
      id: 1,
    } as never);

    const { res, body } = await runCreateRecordedSet(USER);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    expect(body).toMatchObject({
      success: true,
      message: "Recorded set created successfully",
    });
  });
});

describe("listRecordedSets", () => {
  const page = { limit: 20, offset: 0, hasMore: false, nextOffset: null };
  const listResult = {
    items: [
      { id: 1, processingStatus: "PENDING" },
      { id: 2, processingStatus: "COMPLETED" },
    ],
    page,
  };

  beforeEach(() => {
    vi.mocked(recordedSetService.listRecordedSets).mockResolvedValue(
      listResult as never,
    );
  });

  it("defaults limit to 20 and offset to 0", async () => {
    await runListRecordedSets();

    expect(recordedSetService.listRecordedSets).toHaveBeenCalledWith({
      userUuid: "uuid-1",
      limit: 20,
      offset: 0,
      exerciseCode: undefined,
      processingStatus: undefined,
    });
  });

  it("forwards limit, offset and exerciseCode from the query", async () => {
    await runListRecordedSets({
      limit: 5,
      offset: 10,
      exerciseCode: "PUSH_UP",
    });

    expect(recordedSetService.listRecordedSets).toHaveBeenCalledWith({
      userUuid: "uuid-1",
      limit: 5,
      offset: 10,
      exerciseCode: "PUSH_UP",
      processingStatus: undefined,
    });
  });

  it("passes processingStatus through to the service", async () => {
    await runListRecordedSets({ processingStatus: "PROCESSING" });

    expect(recordedSetService.listRecordedSets).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: "PROCESSING" }),
    );
  });
});
