import jwt from "jsonwebtoken";
import { Role } from "@repo/db";

import authenticateToken from "../../../../src/middlewares/auth/authentication";
import ForbiddenError from "../../../../src/errors/ForbiddenError";
import UnauthorizedError from "../../../../src/errors/UnauthorizedError";
import { env } from "../../../../src/config/env";
import {
  createMockNext,
  createMockRequest,
  createMockResponse,
} from "../../helpers/expressMocks";

const signed = (options: jwt.SignOptions = {}, secret = env.jwt.secret) =>
  jwt.sign({ sub: "uuid-1", role: Role.USER }, secret, options);

const run = (authorization?: string) => {
  const req = createMockRequest({
    headers: authorization ? { authorization } : {},
  });
  const next = createMockNext();

  authenticateToken(req, createMockResponse(), next);

  return { req, next, error: next.mock.calls[0]?.[0] as unknown };
};

describe("authenticateToken", () => {
  describe("header parsing", () => {
    it.for([
      ["the header is absent", undefined],
      ["the scheme is not Bearer", "Basic abc"],
      ["the header is exactly 'Bearer'", "Bearer"],
    ])("rejects when %s", ([_label, authorization]) => {
      const { error } = run(authorization);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect((error as Error).message).toBe(
        "Authorization header missing or malformed",
      );
    });
  });

  describe("token verification", () => {
    it("populates req.user and calls next cleanly for a valid token", () => {
      const { req, next } = run(`Bearer ${signed()}`);

      expect(req.user?.sub).toBe("uuid-1");
      expect(req.user?.role).toBe(Role.USER);
      expect(next).toHaveBeenCalledWith();
    });

    it("returns 403 for a token signed with a different secret", () => {
      const { error } = run(
        `Bearer ${signed({}, "a-completely-different-secret")}`,
      );

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as Error).message).toMatch(/^Invalid token: /);
    });

    it("returns 403 for a malformed token", () => {
      const { error } = run("Bearer not-a-jwt");

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as Error).message).toMatch(/^Invalid token: /);
    });

    it("returns 401 for an expired token", () => {
      const { error } = run(`Bearer ${signed({ expiresIn: "-1s" })}`);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect((error as Error).message).toMatch(/^Token expired: /);
    });

    it("leaves req.user unset when verification fails", () => {
      const { req } = run("Bearer not-a-jwt");

      expect(req.user).toBeUndefined();
    });
  });
});
