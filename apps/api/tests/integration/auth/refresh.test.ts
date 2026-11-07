import crypto from "crypto";
import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";

import { RegisterUserBuilder } from "../builders/registerUserBuilder";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import {
  registerUser,
  refreshToken,
} from "../helpers/requestSender/authRequests";

describe("POST /api/auth/refresh", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should return new access and refresh tokens for a valid refresh token", async () => {
    const dto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const originalRefreshToken: string = registerRes.body.data.refreshToken;

    const response = await refreshToken(app, originalRefreshToken);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data).toHaveProperty("token");
    expect(response.body.data).toHaveProperty("refreshToken");
    expect(response.body.data.refreshToken).not.toBe(originalRefreshToken);
  });

  it("should revoke the old refresh token after rotation", async () => {
    const dto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const originalRefreshToken: string = registerRes.body.data.refreshToken;

    await refreshToken(app, originalRefreshToken);

    const hash = crypto
      .createHash("sha256")
      .update(originalRefreshToken)
      .digest("hex");
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });

    expect(tokenRecord?.revokedAt).not.toBeNull();
  });

  it("should return 401 and revoke the entire family when a revoked token is reused", async () => {
    const dto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const originalRefreshToken: string = registerRes.body.data.refreshToken;

    const firstRefresh = await refreshToken(app, originalRefreshToken);
    expect(firstRefresh.status).toBe(StatusCodes.OK);

    const reuseResponse = await refreshToken(app, originalRefreshToken);

    expect(reuseResponse.status).toBe(StatusCodes.UNAUTHORIZED);

    const hash = crypto
      .createHash("sha256")
      .update(firstRefresh.body.data.refreshToken)
      .digest("hex");
    const newToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    expect(newToken?.revokedAt).not.toBeNull();
  });

  it("should return 401 for an expired refresh token", async () => {
    const dto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const userId: number = registerRes.body.data.user.id;

    const raw = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hash,
        familyId: crypto.randomUUID(),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const response = await refreshToken(app, raw);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("should return 401 for an unknown refresh token", async () => {
    const unknownToken = crypto.randomBytes(32).toString("hex");

    const response = await refreshToken(app, unknownToken);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("should return 400 when refreshToken is missing", async () => {
    const response = await refreshToken(app, "");

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });
});
