import { vi, type Mock } from "vitest";

import type { getPrismaClient } from "@repo/db";

type PrismaClient = ReturnType<typeof getPrismaClient>;

const DELEGATE_METHODS = [
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findMany",
  "create",
  "createMany",
  "update",
  "upsert",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
] as const;

const MODELS = [
  "user",
  "refreshToken",
  "exercise",
  "workoutPlan",
  "workoutExercise",
  "workoutRun",
  "recordedSet",
  "userGoal",
  "poseCapture",
  "bodyMetric",
  "workoutGeneration",
  "analysisResult",
  "analysisFinding",
  "analysisRetry",
] as const;

type MockDelegate = Record<(typeof DELEGATE_METHODS)[number], Mock>;

export type PrismaMock = Record<(typeof MODELS)[number], MockDelegate> & {
  $transaction: Mock;
  $queryRaw: Mock;
  $executeRaw: Mock;
};

const createDelegate = (): MockDelegate =>
  Object.fromEntries(DELEGATE_METHODS.map((m) => [m, vi.fn()])) as MockDelegate;

export const createPrismaMock = (): PrismaMock => {
  const mock = Object.fromEntries(
    MODELS.map((model) => [model, createDelegate()]),
  ) as unknown as PrismaMock;

  mock.$transaction = vi.fn((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: PrismaMock) => unknown)(mock)
      : Promise.all(arg as Promise<unknown>[]),
  );

  mock.$queryRaw = vi.fn();
  mock.$executeRaw = vi.fn();

  return mock;
};

export const asPrismaClient = (mock: PrismaMock): PrismaClient =>
  mock as unknown as PrismaClient;

export const prismaError = (code: string, target?: unknown) =>
  Object.assign(new Error("prisma"), { code, meta: { target } });
