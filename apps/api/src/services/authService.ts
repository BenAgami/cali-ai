import bcrypt from "bcrypt";

import { getPrismaClient } from "@repo/db";
import { RegisterValues, LoginValues } from "@repo/common";

import ConflictError from "../errors/ConflictError";
import UnauthorizedError from "../errors/UnauthorizedError";

import generateJwtToken from "../utils/generateJwtToken";
import {
  PrismaErrorCode,
  isPrismaKnownRequestError,
} from "../utils/prismaErrorCodes";
import { normalizeString } from "../utils/normalizeString";

import refreshTokenService from "./refreshTokenService";

class AuthService {
  private static readonly BCRYPT_ROUNDS = 10;
  private static readonly MAX_USERNAME_ATTEMPTS = 10;
  private static readonly INVALID_CREDENTIALS_MESSAGE =
    "Invalid email or password";

  private get prisma() {
    return getPrismaClient();
  }

  private static generateRandomDigits(length: number = 4): string {
    return Math.floor(Math.random() * Math.pow(10, length))
      .toString()
      .padStart(length, "0");
  }

  private async generateUniqueUsername(baseUsername: string): Promise<string> {
    for (
      let attempt = 0;
      attempt < AuthService.MAX_USERNAME_ATTEMPTS;
      attempt++
    ) {
      const username = `${baseUsername}${AuthService.generateRandomDigits(4)}`;
      const existing = await this.prisma.user.findUnique({
        where: { username },
      });
      if (!existing) return username;
    }
    throw new ConflictError(
      "Unable to generate a unique username. Please try again.",
    );
  }

  async register(data: RegisterValues) {
    const { email, password, name } = data;
    const normalizedEmail = normalizeString(email);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    const baseUsername = normalizedEmail.split("@")[0];
    const username = await this.generateUniqueUsername(baseUsername);
    const hashedPassword = await bcrypt.hash(
      password,
      AuthService.BCRYPT_ROUNDS,
    );

    try {
      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
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
          role: true,
        },
      });

      const token = generateJwtToken({ uuid: user.uuid, role: user.role });
      const refreshToken = await refreshTokenService.createRefreshToken(
        user.id,
      );

      return { user, token, refreshToken };
    } catch (error) {
      if (isPrismaKnownRequestError(error)) {
        if (
          error.code === PrismaErrorCode.UNIQUE_CONSTRAINT_VIOLATION &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes("username")
        )
          throw new ConflictError("Username already taken");
      }
      throw error;
    }
  }

  async login(data: LoginValues) {
    const { email, password } = data;
    const normalizedEmail = normalizeString(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedError(AuthService.INVALID_CREDENTIALS_MESSAGE);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError(AuthService.INVALID_CREDENTIALS_MESSAGE);
    }

    const token = generateJwtToken({ uuid: user.uuid, role: user.role });
    const refreshToken = await refreshTokenService.createRefreshToken(user.id);

    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token, refreshToken };
  }

  async refresh(incomingRaw: string) {
    const { userId, newRefreshToken } =
      await refreshTokenService.rotateRefreshToken(incomingRaw);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { uuid: true, role: true },
    });

    if (!user) throw new UnauthorizedError("Invalid refresh token");

    const token = generateJwtToken({ uuid: user.uuid, role: user.role });

    return { token, refreshToken: newRefreshToken };
  }
}

export default new AuthService();
