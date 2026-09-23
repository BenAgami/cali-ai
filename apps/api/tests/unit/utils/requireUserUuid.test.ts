import { StatusCodes } from "http-status-codes";
import type { Request } from "express";
import { Role } from "@repo/db";

import requireUserUuid from "../../../src/utils/requireUserUuid";
import { createMockRequest, createMockResponse } from "../helpers/expressMocks";

const requestWithUser = (user: Request["user"]): Request =>
  createMockRequest({ user });

describe("requireUserUuid", () => {
  it("returns the uuid and leaves the response untouched", () => {
    const res = createMockResponse();
    const req = requestWithUser({ sub: "uuid-1", role: Role.USER });

    expect(requireUserUuid(req, res)).toBe("uuid-1");
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it.for<[string, Request["user"]]>([
    ["req.user is absent", undefined],
    ["sub is undefined", { role: Role.USER }],
    ["sub is an empty string", { sub: "", role: Role.USER }],
  ])("responds 401 and returns null when %s", ([_label, user]) => {
    const res = createMockResponse();

    expect(requireUserUuid(requestWithUser(user), res)).toBeNull();
    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized access - user UUID is missing",
    });
  });
});
