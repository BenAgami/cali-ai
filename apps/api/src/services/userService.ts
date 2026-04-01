import bcrypt from "bcrypt";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getPrismaClient } from "@repo/db";
import { RegisterValues, LoginValues, UpdateProfileValues, UpsertGoalValues } from "@repo/common";

import ConflictError from "../errors/ConflictError";
import UnauthorizedError from "../errors/UnauthorizedError";
import NotFoundError from "../errors/NotFoundError";

import generateJwtToken from "../utils/generateJwtToken";
import { r2Client } from "../lib/r2";
import { env } from "../config/env";

export class UserService {
  private static readonly BCRYPT_ROUNDS = 10;
  private static readonly MAX_USERNAME_ATTEMPTS = 10;
  private get prisma() {
    return getPrismaClient();
  }

  private static generateRandomDigits(length: number = 4): string {
    return Math.floor(Math.random() * Math.pow(10, length))
      .toString()
      .padStart(length, "0");
  }

  private static normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private async generateUniqueUsername(baseUsername: string): Promise<string> {
    for (
      let attempt = 0;
      attempt < UserService.MAX_USERNAME_ATTEMPTS;
      attempt++
    ) {
      const randomDigits = UserService.generateRandomDigits(4);
      const username = `${baseUsername}${randomDigits}`;

      const existingUsername = await this.prisma.user.findUnique({
        where: { username },
      });

      if (!existingUsername) {
        return username;
      }
    }

    throw new ConflictError(
      "Unable to generate a unique username. Please try again.",
    );
  }

  /**
   * Register a new user
   * @param data - Registration data (name, email, password)
   * @returns Created user without password and JWT token
   */
  async register(data: RegisterValues) {
    const { email, password, name } = data;
    const normalizedEmail = UserService.normalizeEmail(email);

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
      UserService.BCRYPT_ROUNDS,
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

      const token = generateJwtToken({
        uuid: user.uuid,
        role: user.role,
      });

      return { user, token };
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target?.includes("username")) {
        throw new ConflictError("Username already taken");
      }
      throw error;
    }
  }

  /**
   * Login user
   * @param data - Login credentials (email, password)
   * @returns User data without password and JWT token
   */
  async login(data: LoginValues) {
    const { email, password } = data;
    const normalizedEmail = UserService.normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = generateJwtToken({ uuid: user.uuid, role: user.role });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  /**
   * Get user by UUID
   * @param uuid - User UUID
   * @returns User data without password
   */
  async getUserByUuid(uuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
      select: {
        id: true,
        uuid: true,
        email: true,
        fullName: true,
        username: true,
        avatarUrl: true,
        experienceLevel: true,
        createdAt: true,
        updatedAt: true,
        role: true,
        goals: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            goalType: true,
            title: true,
            targetValue: true,
            targetUnit: true,
          },
        },
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
    const normalizedEmail = UserService.normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        uuid: true,
        email: true,
        fullName: true,
        username: true,
        avatarUrl: true,
        experienceLevel: true,
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
   * Update user profile
   * @param uuid - User UUID
   * @param data - Profile update data
   * @returns Updated user
   */
  async updateProfile(uuid: string, data: UpdateProfileValues) {
    try {
      const user = await this.prisma.user.update({
        where: { uuid },
        data: {
          ...(data.username && { username: data.username }),
          ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
          ...(data.experienceLevel && { experienceLevel: data.experienceLevel }),
        },
        select: {
          uuid: true,
          username: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          experienceLevel: true,
          createdAt: true,
          updatedAt: true,
          role: true,
        },
      });

      return user;
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ConflictError("Username already taken");
      }
      throw error;
    }
  }

  /**
   * Get presigned URL for avatar upload
   * @param userUuid - User UUID
   * @returns Upload URL, key, and public URL
   */
  async getAvatarUploadUrl(userUuid: string) {
    const key = `avatars/${userUuid}/${Date.now()}.jpg`;

    const command = new PutObjectCommand({
      Bucket: env.r2.bucketName,
      Key: key,
      ContentType: "image/jpeg",
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });

    return {
      uploadUrl,
      key,
      publicUrl: `https://${env.r2.publicDomain}/${key}`,
    };
  }

  /**
   * Create a goal for a user
   * @param uuid - User UUID
   * @param data - Goal data
   * @returns Created goal
   */
  async createGoal(uuid: string, data: UpsertGoalValues) {
    const user = await this.prisma.user.findUnique({
      where: { uuid },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const goal = await this.prisma.userGoal.create({
      data: {
        userId: user.id,
        goalType: data.goalType,
        title: data.title,
        targetValue: data.targetValue,
        targetUnit: data.targetUnit,
        status: "ACTIVE",
      },
      select: {
        id: true,
        goalType: true,
        title: true,
        targetValue: true,
        targetUnit: true,
        status: true,
        createdAt: true,
      },
    });

    return goal;
  }
}

export default new UserService();
