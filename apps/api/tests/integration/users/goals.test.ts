import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { postMyGoal } from "../helpers/requestSender/usersRequests";
import { registerUser } from "../helpers/requestSender/authRequests";

import {
  RegisterUserBuilder,
  RegisterUserDto,
} from "../builders/registerUserBuilder";

describe("POST /api/users/me/goals", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should create a goal with goalType and title", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    const response = await postMyGoal(
      app,
      { goalType: "STRENGTH", title: "Get to 20 push-ups" },
      token,
    );

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.success).toBe(true);
    expect(response.body.data.goalType).toBe("STRENGTH");
    expect(response.body.data.title).toBe("Get to 20 push-ups");
  });

  it("should create a goal with targetValue and targetUnit", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    const response = await postMyGoal(
      app,
      {
        goalType: "SKILL",
        title: "Learn planche",
        targetValue: 30,
        targetUnit: "seconds",
      },
      token,
    );

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.success).toBe(true);
    expect(response.body.data.targetValue).toBe("30");
    expect(response.body.data.targetUnit).toBe("seconds");
  });

  it("should reject missing goalType with 400", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    const response = await postMyGoal(app, { title: "test" }, token);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should reject title longer than 100 chars with 400", async () => {
    const dto: RegisterUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, dto);
    const token = registerRes.body.data.token;

    const longTitle = "a".repeat(101);

    const response = await postMyGoal(
      app,
      { goalType: "STRENGTH", title: longTitle },
      token,
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should return 401 without auth token", async () => {
    const response = await postMyGoal(app, {
      goalType: "STRENGTH",
      title: "test",
    });

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
