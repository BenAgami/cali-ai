import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { connectPrisma, getPrismaClient } from "@repo/db";

import {
  RegisterUserDto,
  RegisterUserBuilder,
} from "../builders/registerUserBuilder";
import { LoginUserBuilder, LoginUserDto } from "../builders/loginUserBuilder";
import { registerUser, loginUser } from "../helpers/requestSender/authRequests";

import { createApp } from "../../../src/app";

describe("POST /api/users/login", () => {
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

  it("should login successfully with valid credentials", async () => {
    const registerUserDto: RegisterUserDto = new RegisterUserBuilder().build();

    await registerUser(app, registerUserDto);

    const loginUserDto: LoginUserDto = new LoginUserBuilder()
      .fromRegisterDto(registerUserDto)
      .build();

    const response = await loginUser(app, loginUserDto);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data).toHaveProperty("user");
    expect(response.body.data).toHaveProperty("token");
  });

  it("should return 401 for wrong password", async () => {
    const registerUserDto: RegisterUserDto = new RegisterUserBuilder().build();

    await registerUser(app, registerUserDto);

    const loginUserDto = new LoginUserBuilder()
      .fromRegisterDto(registerUserDto)
      .setPassword("WrongPassword123!")
      .build();

    const response = await loginUser(app, loginUserDto);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("should return 401 if user does not exist", async () => {
    const loginUserDto: LoginUserDto = new LoginUserBuilder().build();

    const response = await loginUser(app, loginUserDto);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("should return 400 for invalid email format", async () => {
    const loginUserDto: LoginUserDto = new LoginUserBuilder()
      .setEmail("invalid-email")
      .build();

    const response = await loginUser(app, loginUserDto);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toBe(
      "body.email - Enter a valid email",
    );
  });

  it("should return 400 when email is missing", async () => {
    const loginUserDto: LoginUserDto = new LoginUserBuilder()
      .setEmail(undefined)
      .build();

    const response = await loginUser(app, loginUserDto);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toBe(
      "body.email - Enter a valid email",
    );
  });

  it("should return 400 when password is missing", async () => {
    const loginUserDto: LoginUserDto = new LoginUserBuilder()
      .setPassword(undefined)
      .build();

    const response = await loginUser(app, loginUserDto);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toBe(
      "body.password - Invalid input: expected string, received undefined",
    );
  });
});
