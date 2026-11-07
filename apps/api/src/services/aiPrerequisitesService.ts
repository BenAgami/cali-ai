import { getPrismaClient, type ExperienceLevel, type GoalType } from "@repo/db";
import {
  getMissingAiPrerequisites,
  type AiPrerequisiteCode,
} from "@repo/common";

import { NotFoundError, PreconditionRequiredError } from "../errors";

import bodyMetricService from "./bodyMetricService";

export type AiUserContext = {
  userId: number;
  experienceLevel: ExperienceLevel;
  goal: { goalType: GoalType; title: string };
  heightCm: number;
  weightKg: number;
};

const MESSAGES: Record<AiPrerequisiteCode, string> = {
  PROFILE_INCOMPLETE:
    "Set your fitness level and primary goal before using AI features",
  BODY_METRICS_REQUIRED: "Add your height and weight before using AI features",
  AI_CONSENT_REQUIRED: "Accept the AI privacy notice before using AI features",
};

export class AiPrerequisitesService {
  private get prisma() {
    return getPrismaClient();
  }

  async assertAiPrerequisites(userId: number): Promise<AiUserContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        experienceLevel: true,
        aiConsentVersion: true,
        goals: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { goalType: true, title: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const bodyMetric = await bodyMetricService.getLatest(userId);
    const goal = user.goals[0];

    const missing = getMissingAiPrerequisites({
      experienceLevel: user.experienceLevel,
      hasActiveGoal: goal !== undefined,
      hasBodyMetric: bodyMetric !== null,
      aiConsentVersion: user.aiConsentVersion,
    });

    const [code] = missing;
    if (code) {
      throw new PreconditionRequiredError(MESSAGES[code], code);
    }

    return {
      userId,
      experienceLevel: user.experienceLevel!,
      goal: { goalType: goal.goalType, title: goal.title },
      heightCm: bodyMetric!.heightCm,
      weightKg: bodyMetric!.weightKg,
    };
  }
}

export default new AiPrerequisitesService();
