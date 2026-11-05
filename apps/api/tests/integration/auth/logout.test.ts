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
  logoutUser,
  refreshToken,
} from "../helpers/requestSender/authRequests";

describe("POST /api/auth/logout", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should revoke the refresh token and prevent further use", async () => {
    const dto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const rawRefreshToken: string = registerRes.body.data.refreshToken;

    const logoutRes = await logoutUser(app, rawRefreshToken);
    expect(logoutRes.status).toBe(StatusCodes.OK);

    const hash = crypto
      .createHash("sha256")
      .update(rawRefreshToken)
      .digest("hex");
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    expect(tokenRecord?.revokedAt).not.toBeNull();

    const refreshRes = await refreshToken(app, rawRefreshToken);
    expect(refreshRes.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("should return 200 even for an already-revoked token (idempotent)", async () => {
    const dto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const rawRefreshToken: string = registerRes.body.data.refreshToken;

    await logoutUser(app, rawRefreshToken);
    const secondLogoutRes = await logoutUser(app, rawRefreshToken);

    expect(secondLogoutRes.status).toBe(StatusCodes.OK);
  });

  it("should return 400 when refreshToken is missing", async () => {
    const response = await logoutUser(app, "");

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });
});
