import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { connectPrisma, getPrismaClient } from "@repo/db";

import {
  getMyUser,
} from "../helpers/requestSender/usersRequests";
import { registerUser } from "../helpers/requestSender/authRequests";
import {
  RegisterUserBuilder,
  RegisterUserDto,
} from "../builders/registerUserBuilder";

import { createApp } from "../../../src/app";

describe("GET /api/me", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    app = createApp();
    await connectPrisma(process.env.DATABASE_URL!, false);
    prisma = getPrismaClient();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it("should return the current user if token is valid", async () => {
    const registerUserDto: RegisterUserDto = new RegisterUserBuilder().build();

    const res = await registerUser(app, registerUserDto);

    const token = res.body.data.token;
    const user = res.body.data.user;

    const response = await getMyUser(app, token);

    expect(response.status).toBe(200);
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
});
