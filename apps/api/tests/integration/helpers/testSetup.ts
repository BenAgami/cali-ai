import { Application } from "express";

import { connectPrisma, getPrismaClient } from "@repo/db";

import { createApp } from "../../../src/app";

export type TestAppContext = {
  app: Application;
  prisma: ReturnType<typeof getPrismaClient>;
};

const cleanupDatabase = async (
  prisma: ReturnType<typeof getPrismaClient>,
) => {
  await prisma.analysisFinding.deleteMany();
  await prisma.analysisResult.deleteMany();
  await prisma.userMilestone.deleteMany();
  await prisma.userGoal.deleteMany();
  await prisma.bodyMetric.deleteMany();
  await prisma.workoutSession.deleteMany();
  await prisma.milestoneDefinition.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.user.deleteMany();
};

export const setupIntegrationTest = async (): Promise<TestAppContext> => {
  const app = createApp();
  await connectPrisma(process.env.DATABASE_URL!, false);
  const prisma = getPrismaClient();

  return { app, prisma };
};

export const teardownIntegrationTest = async (
  prisma: ReturnType<typeof getPrismaClient>,
) => {
  await cleanupDatabase(prisma);
  await prisma.$disconnect();
};
