import { type getPrismaClient } from "@repo/db";
import { AI_CONSENT_VERSION } from "@repo/common";

export const grantAiPrerequisites = async (
  prisma: ReturnType<typeof getPrismaClient>,
  userId: number,
): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      experienceLevel: "BEGINNER",
      aiConsentAt: new Date(),
      aiConsentVersion: AI_CONSENT_VERSION,
    },
  });
  await prisma.userGoal.create({
    data: {
      userId,
      goalType: "STRENGTH",
      title: "Get stronger",
      status: "ACTIVE",
    },
  });
  await prisma.bodyMetric.create({
    data: { userId, heightCm: 180, weightKg: 75 },
  });
};
