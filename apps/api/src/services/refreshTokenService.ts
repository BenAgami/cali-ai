import crypto from "crypto";
import ms from "ms";

import { getPrismaClient } from "@repo/db";

import { UnauthorizedError } from "../errors";
import { generateRefreshToken } from "../utils/generateRefreshToken";
import { env } from "../config/env";

export class RefreshTokenService {
  private get prisma() {
    return getPrismaClient();
  }

  private getExpiresAt(): Date {
    return new Date(Date.now() + ms(env.jwt.refreshExpiresIn));
  }

  async createRefreshToken(userId: number, familyId?: string): Promise<string> {
    const { raw, hash } = generateRefreshToken();
    const family = familyId ?? crypto.randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hash,
        familyId: family,
        expiresAt: this.getExpiresAt(),
      },
    });

    return raw;
  }

  async rotateRefreshToken(
    incomingRaw: string,
  ): Promise<{ userId: number; newRefreshToken: string }> {
    const hash = crypto.createHash("sha256").update(incomingRaw).digest("hex");

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });

    if (!tokenRecord) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (tokenRecord.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (tokenRecord.expiresAt <= new Date()) {
      throw new UnauthorizedError("Refresh token expired");
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    const newRefreshToken = await this.createRefreshToken(
      tokenRecord.userId,
      tokenRecord.familyId,
    );

    return { userId: tokenRecord.userId, newRefreshToken };
  }

  async revokeToken(incomingRaw: string): Promise<void> {
    const hash = crypto.createHash("sha256").update(incomingRaw).digest("hex");

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export default new RefreshTokenService();
