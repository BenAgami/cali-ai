import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient, connectPrisma } from "@repo/db";

import {
  RegisterUserDto,
  RegisterUserBuilder,
} from "../builders/registerUserBuilder";
import { registerUser } from "../helpers/requestSender/authRequests";

import { createApp } from "../../../src/app";

describe("POST /api/users/register", () => {
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

  it("should register a new user successfully", async () => {
    const user: RegisterUserDto = new RegisterUserBuilder().build();

    const response = await registerUser(app, user);

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.data).toHaveProperty("user");
    expect(response.body.data).toHaveProperty("token");
    expect(response.body.data.user).toHaveProperty("id");
    expect(response.body.data.user.email).toBe(user.email);
    expect(response.body.data.user).not.toHaveProperty("password");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("should return 400 for missing email", async () => {
    const user: RegisterUserDto = new RegisterUserBuilder()
      .setEmail(undefined)
      .build();

    const response = await registerUser(app, user);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toBe(
      "body.email - Enter a valid email",
    );
  });

  it("should return 400 for invalid email format", async () => {
    const user: RegisterUserDto = new RegisterUserBuilder()
      .setEmail("invalid-email")
      .build();

    const response = await registerUser(app, user);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toBe(
      "body.email - Enter a valid email",
    );
  });

  it("should return 400 for weak password", async () => {
    const user: RegisterUserDto = new RegisterUserBuilder()
      .setPassword("123")
      .build();

    const response = await registerUser(app, user);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toBe(
      "body.password - Password must be at least 8 characters",
    );
  });

  it("should return 409 for duplicate email", async () => {
    const email = "duplicate@example.com";

    const user: RegisterUserDto = new RegisterUserBuilder()
      .setEmail(email)
      .build();

    await registerUser(app, user);

    const response = await registerUser(app, user);

    expect(response.status).toBe(StatusCodes.CONFLICT);
    expect(response.body.message).toBe("User with this email already exists");
  });

  it("should return 400 for missing password", async () => {
    const user: RegisterUserDto = new RegisterUserBuilder()
      .setPassword(undefined)
      .build();

    const response = await registerUser(app, user);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toBe(
      "body.password - Invalid input: expected string, received undefined",
    );
  });

  it("should return 400 for missing name", async () => {
    const user: RegisterUserDto = new RegisterUserBuilder()
      .setName(undefined)
      .build();

    const response = await registerUser(app, user);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toBe(
      "body.name - Invalid input: expected string, received undefined",
    );
  });
});
