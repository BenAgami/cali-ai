import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getPrismaClient } from "@repo/db";
import { UpdateProfileValues, UpsertGoalValues } from "@repo/common";

import { ConflictError, NotFoundError } from "../errors";

import {
  PrismaErrorCode,
  isPrismaKnownRequestError,
} from "../utils/prismaErrorCodes";
import { normalizeString } from "../utils/normalizeString";

import { r2Client } from "../lib/r2";
import { env } from "../config/env";

export class UserService {
  private get prisma() {
    return getPrismaClient();
  }

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

  async getUserByEmail(email: string) {
    const normalizedEmail = normalizeString(email);

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

  async updateProfile(uuid: string, data: UpdateProfileValues) {
    try {
      const user = await this.prisma.user.update({
        where: { uuid },
        data: {
          ...(data.username && { username: data.username }),
          ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
          ...(data.experienceLevel && {
            experienceLevel: data.experienceLevel,
          }),
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
    } catch (error) {
      if (
        isPrismaKnownRequestError(error) &&
        error.code === PrismaErrorCode.UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new ConflictError("Username already taken");
      }
      throw error;
    }
  }

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
