import type { Application } from "express";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";

import type { getPrismaClient } from "@repo/db";

import { env } from "../../../src/config/env";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { getMyUser } from "../helpers/requestSender/usersRequests";
import { registerUser } from "../helpers/requestSender/authRequests";

import {
  RegisterUserBuilder,
  type RegisterUserDto,
} from "../builders/registerUserBuilder";

describe("GET /api/me", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should return the current user if token is valid", async () => {
    const registerUserDto: RegisterUserDto = new RegisterUserBuilder().build();

    const res = await registerUser(app, registerUserDto);

    const token = res.body.data.token;
    const user = res.body.data.user;

    const response = await getMyUser(app, token);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.success).toBe(true);
    expect(response.body.data.uuid).toBe(user.uuid);
    expect(response.body.data.role).toBe(user.role);
    expect(response.body.data).not.toHaveProperty("password");
    expect(response.body.data).not.toHaveProperty("passwordHash");
  });

  it("should return 401 if no token is provided", async () => {
    const response = await getMyUser(app, "");

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(response.body.message).toBe(
      "Authorization header missing or malformed",
    );
  });

  it("should return 401 if token is invalid", async () => {
    const response = await getMyUser(app, "invalid-token");

    expect(response.status).toBe(StatusCodes.FORBIDDEN);
    expect(response.body.message).toBe("Invalid token: jwt malformed");
  });

  it("should return 401 if token is expired", async () => {
    const expiredToken = jwt.sign(
      { sub: "test", exp: Math.floor(Date.now() / 1000) - 3600 },
      env.jwt.secret,
    );

    const response = await getMyUser(app, expiredToken);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(response.body.message).toBe("Token expired: jwt expired");
  });
});
