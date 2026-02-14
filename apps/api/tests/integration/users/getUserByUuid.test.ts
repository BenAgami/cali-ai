import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { connectPrisma, getPrismaClient } from "@repo/db";

import { getUserByUuid } from "../helpers/requestSender/usersRequests";
import { registerUser } from "../helpers/requestSender/authRequests";
import {
  RegisterUserBuilder,
  RegisterUserDto,
} from "../builders/registerUserBuilder";

import { createApp } from "../../../src/app";

describe("GET /api/users/:uuid", () => {
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

  it("should return user by uuid", async () => {
    const registerDto: RegisterUserDto = new RegisterUserBuilder().build();

    const registerResponse = await registerUser(app, registerDto);

    expect(registerResponse.status).toBe(StatusCodes.CREATED);

    const createdUser = registerResponse.body.data;

    const response = await getUserByUuid(app, createdUser.uuid);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data).toMatchObject({
      uuid: createdUser.uuid,
      email: registerDto.email,
    });
    expect(response.body.data).not.toHaveProperty("password");
    expect(response.body.data).not.toHaveProperty("passwordHash");
  });

  it("should return 404 when user does not exist", async () => {
    const nonExistingUuidV7 = "019c5b91-9cc1-7c36-be7b-ab32d8145188";

    const response = await getUserByUuid(app, nonExistingUuidV7);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
    expect(response.body.message).toBe("User not found");
  });

  it("should return 400 when uuid is missing", async () => {
    const response = await getUserByUuid(app, undefined);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toBe("params.uuid - Invalid UUID");
  });
});
