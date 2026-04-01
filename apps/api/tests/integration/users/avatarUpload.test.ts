import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { postAvatarUploadUrl } from "../helpers/requestSender/usersRequests";
import { registerUser } from "../helpers/requestSender/authRequests";

import {
  RegisterUserBuilder,
  RegisterUserDto,
} from "../builders/registerUserBuilder";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://mock-r2.example.com/signed"),
}));

vi.mock("../../../src/lib/r2", () => ({
  r2Client: {},
}));

describe("POST /api/users/me/avatar-upload-url", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should return uploadUrl, key, and publicUrl", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    const response = await postAvatarUploadUrl(app, token);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.uploadUrl).toBe("string");
    expect(response.body.data.uploadUrl).toContain("mock-r2.example.com");
    expect(response.body.data.key).toMatch(/^avatars\//);
    expect(typeof response.body.data.publicUrl).toBe("string");
  });

  it("should return 401 without auth token", async () => {
    const response = await postAvatarUploadUrl(app);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
