import { vi, type Mock } from "vitest";

import type { getPrismaClient } from "@repo/db";

type PrismaClient = ReturnType<typeof getPrismaClient>;

const DELEGATE_METHODS = [
  "findUnique",
  "findFirst",
  "findMany",
  "create",
  "createMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
] as const;

const MODELS = [
  "user",
  "refreshToken",
  "exercise",
  "workout",
  "workoutExercise",
  "workoutLog",
  "workoutSession",
  "userGoal",
] as const;

type MockDelegate = Record<(typeof DELEGATE_METHODS)[number], Mock>;

export type PrismaMock = Record<(typeof MODELS)[number], MockDelegate> & {
  $transaction: Mock;
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

  return mock;
};

export const asPrismaClient = (mock: PrismaMock): PrismaClient =>
  mock as unknown as PrismaClient;
