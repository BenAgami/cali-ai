import { getPrismaClient } from "@repo/db";
import type { BodyMetricInput } from "@repo/common";

import { getUserIdByUuid } from "../utils/getUserIdByUuid";

const roundOneDecimal = (value: number): number => Math.round(value * 10) / 10;

export type LatestBodyMetric = {
  heightCm: number;
  weightKg: number;
  createdAt: Date;
};

const bodyMetricSelect = {
  heightCm: true,
  weightKg: true,
  createdAt: true,
} as const;

export class BodyMetricService {
  private get prisma() {
    return getPrismaClient();
  }

  async getLatest(userId: number): Promise<LatestBodyMetric | null> {
    return this.prisma.bodyMetric.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: bodyMetricSelect,
    });
  }

  async saveIfChanged(
    userUuid: string,
    input: BodyMetricInput,
  ): Promise<{ bodyMetric: LatestBodyMetric; created: boolean }> {
    const userId = await getUserIdByUuid(this.prisma, userUuid);
    const heightCm = roundOneDecimal(input.heightCm);
    const weightKg = roundOneDecimal(input.weightKg);

    const latest = await this.getLatest(userId);
    if (
      latest &&
      latest.heightCm === heightCm &&
      latest.weightKg === weightKg
    ) {
      return { bodyMetric: latest, created: false };
    }

    const bodyMetric = await this.prisma.bodyMetric.create({
      data: { userId, heightCm, weightKg },
      select: bodyMetricSelect,
    });
    return { bodyMetric, created: true };
  }
}

export default new BodyMetricService();
