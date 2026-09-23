import jwt from "jsonwebtoken";
import { Role } from "@repo/db";

import optionalAuth from "../../../../src/middlewares/auth/optionalAuth";
import { env } from "../../../../src/config/env";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../../helpers/expressMocks";

const signed = (options: jwt.SignOptions = {}) =>
  jwt.sign({ sub: "uuid-1", role: Role.USER }, env.jwt.secret, options);

const run = (authorization?: string) => {
  const req = createMockRequest({
    headers: authorization ? { authorization } : {},
  });
  const next = createMockNext();

  optionalAuth(req, createMockResponse(), next);

  return { req, next };
};

describe("optionalAuth", () => {
  it("populates req.user for a valid token", () => {
    const { req, next } = run(`Bearer ${signed()}`);

    expect(req.user?.sub).toBe("uuid-1");
    expect(next).toHaveBeenCalledWith();
  });

  it.for([
    ["no header is present", undefined],
    ["the scheme is not Bearer", "Basic abc"],
    ["the token is malformed", "Bearer not-a-jwt"],
    [
      "the token is signed with a different secret",
      `Bearer ${jwt.sign({ sub: "x" }, "another-secret-entirely")}`,
    ],
  ])("continues anonymously when %s", ([_label, authorization]) => {
    let result: ReturnType<typeof run>;
    expect(() => {
      result = run(authorization);
    }).not.toThrow();

    expect(result!.req.user).toBeUndefined();
    expect(result!.next).toHaveBeenCalledTimes(1);
    expect(result!.next).toHaveBeenCalledWith();
  });

  it("continues anonymously for an expired token", () => {
    const { req, next } = run(`Bearer ${signed({ expiresIn: "-1s" })}`);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });
});
