import { StatusCodes } from "http-status-codes";
import { Role } from "@repo/db";

import authorize from "../../../../src/middlewares/auth/authorization";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../../helpers/expressMocks";

const runWithRole = (role: Role | undefined, ...allowed: Role[]) => {
  const req = createMockRequest(
    role ? { user: { sub: "uuid-1", role } } : undefined,
  );
  const res = createMockResponse();
  const next = createMockNext();

  authorize(...allowed)(req, res, next);

  return { res, next };
};

describe("authorize", () => {
  it("responds 401 when the request is unauthenticated", () => {
    const { res, next } = runWithRole(undefined, Role.USER);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authentication required to access this resource",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("responds 403 when the role is not allowed", () => {
    const { res, next } = runWithRole(Role.USER, Role.ADMIN);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "You do not have permission to access this resource",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next with no arguments when the role is allowed", () => {
    const { res, next } = runWithRole(Role.ADMIN, Role.ADMIN);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.for([Role.ADMIN, Role.USER])(
    "admits %s when several roles are allowed",
    (role) => {
      const { next } = runWithRole(role, Role.ADMIN, Role.USER);

      expect(next).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects every authenticated user when no roles are allowed", () => {
    const { res, next } = runWithRole(Role.ADMIN);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
    expect(next).not.toHaveBeenCalled();
  });

  it("checks authentication before the role, yielding 401 not 403", () => {
    const { res } = runWithRole(undefined, Role.ADMIN);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(res.status).not.toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
  });
});
