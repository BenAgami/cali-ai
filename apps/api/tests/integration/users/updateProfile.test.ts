import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import {
  getMyUser,
  patchMyProfile,
  postMyGoal,
} from "../helpers/requestSender/usersRequests";
import { registerUser } from "../helpers/requestSender/authRequests";

import {
  RegisterUserBuilder,
  RegisterUserDto,
} from "../builders/registerUserBuilder";

describe("PATCH /api/users/me", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should update username", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    const response = await patchMyProfile(
      app,
      { username: "newname123" },
      token,
    );

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.success).toBe(true);
    expect(response.body.data.username).toBe("newname123");
  });

  it("should update experienceLevel", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    const response = await patchMyProfile(
      app,
      { experienceLevel: "ADVANCED" },
      token,
    );

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.success).toBe(true);
    expect(response.body.data.experienceLevel).toBe("ADVANCED");
  });

  it("should reject duplicate username with 409", async () => {
    const dto1: RegisterUserDto = new RegisterUserBuilder().build();
    const dto2: RegisterUserDto = new RegisterUserBuilder().build();

    const registerRes1 = await registerUser(app, dto1);
    const registerRes2 = await registerUser(app, dto2);

    const token2 = registerRes2.body.data.token;
    const username1 = registerRes1.body.data.user.username;

    const response = await patchMyProfile(
      app,
      { username: username1 },
      token2,
    );

    expect(response.status).toBe(StatusCodes.CONFLICT);
  });

  it("should reject empty body with 400", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    const response = await patchMyProfile(app, {}, token);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should reject username shorter than 3 chars", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    const response = await patchMyProfile(app, { username: "ab" }, token);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should return avatarUrl and experienceLevel in GET /me", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    await patchMyProfile(app, { experienceLevel: "INTERMEDIATE" }, token);

    const response = await getMyUser(app, token);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data).toHaveProperty("avatarUrl");
    expect(response.body.data.experienceLevel).toBe("INTERMEDIATE");
  });

  it("should return active goal in GET /me after creating one", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    await postMyGoal(
      app,
      { goalType: "STRENGTH", title: "Get to 20 push-ups" },
      token,
    );

    const response = await getMyUser(app, token);

    expect(response.status).toBe(StatusCodes.OK);
    expect(Array.isArray(response.body.data.goals)).toBe(true);
    expect(response.body.data.goals.length).toBe(1);
    expect(response.body.data.goals[0].goalType).toBe("STRENGTH");
  });

  it("should return 401 without auth token", async () => {
    const response = await patchMyProfile(app, { username: "noauth" });

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
