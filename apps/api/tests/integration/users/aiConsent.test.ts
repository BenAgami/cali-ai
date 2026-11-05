import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";
import { AI_CONSENT_VERSION } from "@repo/common";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import {
  getMyUser,
  postMyAiConsent,
} from "../helpers/requestSender/usersRequests";
import { registerUser } from "../helpers/requestSender/authRequests";

import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("POST /api/users/me/ai-consent", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  const registerAndGetToken = async () => {
    const res = await registerUser(app, new RegisterUserBuilder().build());
    return res.body.data.token as string;
  };

  it("should persist consent and expose it on GET /me", async () => {
    const token = await registerAndGetToken();

    const response = await postMyAiConsent(
      app,
      { version: AI_CONSENT_VERSION },
      token,
    );

    expect(response.status).toBe(StatusCodes.OK);

    const profile = await getMyUser(app, token);
    expect(profile.body.data.aiConsentVersion).toBe(AI_CONSENT_VERSION);
    expect(typeof profile.body.data.aiConsentAt).toBe("string");
  });

  it("should return 400 for an unknown consent version", async () => {
    const token = await registerAndGetToken();

    const response = await postMyAiConsent(
      app,
      { version: "1999-01-01" },
      token,
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should return 401 without a token", async () => {
    const response = await postMyAiConsent(app, {
      version: AI_CONSENT_VERSION,
    });

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
