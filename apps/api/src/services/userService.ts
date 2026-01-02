import bcrypt from "bcrypt";

import { prisma } from "@repo/db";
import { RegisterValues, LoginValues } from "@repo/common";

import ConflictError from "../errors/ConflictError";
import UnauthorizedError from "../errors/UnauthorizedError";
import NotFoundError from "../errors/NotFoundError";

export class UserService {
  private static readonly BCRYPT_ROUNDS = 10;

  private static generateRandomDigits(length: number = 4): string {
    return Math.floor(Math.random() * Math.pow(10, length))
      .toString()
      .padStart(length, "0");
  }

  /**
   * Register a new user
   * @param data - Registration data (name, email, password)
   * @returns Created user without password
   */
  async register(data: RegisterValues) {
    const { email, password, name } = data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    const baseUsername = email.split("@")[0];
    const randomDigits = UserService.generateRandomDigits(4);
    const username = `${baseUsername}${randomDigits}`;

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      throw new ConflictError("Username already taken");
    }

    const hashedPassword = await bcrypt.hash(
      password,
      UserService.BCRYPT_ROUNDS
    );

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: name,
        username,
      },
      select: {
        id: true,
        uuid: true,
        email: true,
        fullName: true,
        username: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Login user
   * @param data - Login credentials (email, password)
   * @returns User data without password
   */
  async login(data: LoginValues) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Get user by UUID
   * @param uuid - User UUID
   * @returns User data without password
   */
  async getUserByUuid(uuid: string) {
    const user = await prisma.user.findUnique({
      where: { uuid },
      select: {
        id: true,
        uuid: true,
        email: true,
        fullName: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }

  /**
   * Get user by email
   * @param email - User email
   * @returns User data without password
   */
  async getUserByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        uuid: true,
        email: true,
        fullName: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }
}

export default new UserService();
