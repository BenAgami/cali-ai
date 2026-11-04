import { getPrismaClient } from "@repo/db";
import { StatusCodes } from "http-status-codes";

import {
  ConflictError,
  PreconditionRequiredError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../../../src/errors";
import { getLlmProvider, LlmError } from "../../../src/lib/llm";
import type { WorkoutPlanResult } from "../../../src/lib/llm";
import aiPrerequisitesService from "../../../src/services/aiPrerequisitesService";
import {
  createFakeLlmProvider,
  type FakeStep,
} from "../helpers/fakeLlmProvider";
import {
  asPrismaClient,
  createPrismaMock,
  type PrismaMock,
} from "../helpers/prismaMock";

const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  getPrismaClient: vi.fn(),
}));
vi.mock("../../../src/lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/llm")>()),
  getLlmProvider: vi.fn(),
}));
vi.mock("../../../src/services/aiPrerequisitesService", () => ({
  default: { assertAiPrerequisites: vi.fn() },
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { child: vi.fn(() => mockLog) },
}));

const { WorkoutGenerationService } =
  await import("../../../src/services/workoutGenerationService");

const NOW = new Date("2026-11-04T12:00:00Z");
const USER_ID = 7;
const GENERATION_ID = 99;

const catalogRows = [
  { id: 1, code: "push_up", displayName: "Push-up", exerciseType: "DYNAMIC" },
  { id: 2, code: "pull_up", displayName: "Pull-up", exerciseType: "DYNAMIC" },
  { id: 4, code: "plank", displayName: "Plank", exerciseType: "STATIC_HOLD" },
];

const goodPlan = (): WorkoutPlanResult => ({
  plan: {
    name: "Upper body",
    note: null,
    exercises: [
      {
        exerciseCode: "push_up",
        sets: 3,
        reps: 10,
        durationSecs: null,
        restSecs: 60,
      },
      {
        exerciseCode: "pull_up",
        sets: 3,
        reps: 5,
        durationSecs: null,
        restSecs: 60,
      },
      {
        exerciseCode: "plank",
        sets: 3,
        reps: null,
        durationSecs: 30,
        restSecs: 60,
      },
    ],
  },
  model: "claude-haiku-5-5",
  usage: { inputTokens: 10, outputTokens: 20 },
});

const badPlan = (): WorkoutPlanResult => {
  const result = goodPlan();
  result.plan.exercises[0].exerciseCode = "handstand";
  return result;
};

let prisma: PrismaMock;
let service: InstanceType<typeof WorkoutGenerationService>;

const useProvider = (steps: FakeStep[]) => {
  const provider = createFakeLlmProvider(steps);
  vi.mocked(getLlmProvider).mockReturnValue(provider);
  return provider;
};

const requestAt = (provider: ReturnType<typeof useProvider>, call: number) =>
  provider.generateWorkoutPlan.mock.calls[call][0];

const generate = () => service.generate("uuid-1", { goalText: "get stronger" });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();

  prisma = createPrismaMock();
  vi.mocked(getPrismaClient).mockReturnValue(asPrismaClient(prisma));
  prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
  prisma.workoutGeneration.count.mockResolvedValue(0);
  prisma.workoutGeneration.findFirst.mockResolvedValue(null);
  prisma.exercise.findMany.mockResolvedValue(catalogRows);
  prisma.workoutGeneration.create.mockResolvedValue({ id: GENERATION_ID });
  prisma.workoutGeneration.update.mockResolvedValue({});
  vi.mocked(aiPrerequisitesService.assertAiPrerequisites).mockResolvedValue({
    userId: USER_ID,
    experienceLevel: "BEGINNER",
    goal: { goalType: "STRENGTH", title: "Get strong" },
    heightCm: 180,
    weightKg: 80,
  });
  service = new WorkoutGenerationService();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("WorkoutGenerationService.generate preconditions", () => {
  it("rethrows a failed AI gate without creating a row or calling the LLM", async () => {
    const provider = useProvider([]);
    vi.mocked(aiPrerequisitesService.assertAiPrerequisites).mockRejectedValue(
      new PreconditionRequiredError("no consent", "AI_CONSENT_REQUIRED"),
    );

    await expect(generate()).rejects.toBeInstanceOf(PreconditionRequiredError);

    expect(prisma.workoutGeneration.create).not.toHaveBeenCalled();
    expect(provider.generateWorkoutPlan).not.toHaveBeenCalled();
  });

  it("rejects at the daily cap, counting failed rows in a rolling 24h window", async () => {
    prisma.workoutGeneration.count.mockResolvedValue(10);

    const error = await generate().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TooManyRequestsError);
    expect(error).toMatchObject({
      statusCode: StatusCodes.TOO_MANY_REQUESTS,
      code: "DAILY_LIMIT_REACHED",
    });
    expect(prisma.workoutGeneration.count).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        createdAt: { gte: new Date("2026-11-03T12:00:00Z") },
      },
    });
    expect(prisma.workoutGeneration.create).not.toHaveBeenCalled();
  });

  it("rejects a second concurrent request", async () => {
    prisma.workoutGeneration.findFirst.mockResolvedValue({ id: 1 });

    const error = await generate().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: "GENERATION_IN_PROGRESS" });
    expect(prisma.workoutGeneration.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        status: "PENDING",
        createdAt: { gte: new Date(NOW.getTime() - 60000) },
      },
      select: { id: true },
    });
  });

  it("fails with CATALOG_EMPTY when no exercise is active", async () => {
    prisma.exercise.findMany.mockResolvedValue([]);

    const error = await generate().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ code: "CATALOG_EMPTY" });
    expect(prisma.workoutGeneration.create).not.toHaveBeenCalled();
  });
});

describe("WorkoutGenerationService.generate ladder", () => {
  it("succeeds on attempt 1 and records provenance", async () => {
    const provider = useProvider([goodPlan()]);

    const preview = await generate();

    expect(provider.generateWorkoutPlan).toHaveBeenCalledTimes(1);
    expect(requestAt(provider, 0)).toMatchObject({
      model: "claude-haiku-5-5",
      effort: "low",
      timeoutMs: 15000,
      exerciseCodes: ["push_up", "pull_up", "plank"],
    });
    expect(prisma.workoutGeneration.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        goalText: "get stronger",
        promptVersion: "workout-plan-v1",
      },
      select: { id: true },
    });
    expect(prisma.workoutGeneration.update).toHaveBeenCalledWith({
      where: { id: GENERATION_ID },
      data: {
        status: "SUCCEEDED",
        model: "claude-haiku-5-5",
        attempts: 1,
        completedAt: NOW,
      },
    });
    expect(preview).toMatchObject({
      generationId: GENERATION_ID,
      model: "claude-haiku-5-5",
      name: "Upper body",
      note: null,
    });
    expect(preview.exercises.map((e) => e.exerciseId)).toEqual([1, 2, 4]);
    expect(preview.exercises[0].exercise).toEqual(catalogRows[0]);
  });

  it("retries on haiku with validation feedback after an unknown code", async () => {
    const provider = useProvider([badPlan(), goodPlan()]);

    await generate();

    expect(requestAt(provider, 1).model).toBe("claude-haiku-5-5");
    expect(requestAt(provider, 1).user).toContain(
      "Unknown exercise code: handstand",
    );
    expect(prisma.workoutGeneration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCEEDED", attempts: 2 }),
      }),
    );
  });

  it("escalates to sonnet on the third attempt", async () => {
    const provider = useProvider([badPlan(), badPlan(), goodPlan()]);

    await generate();

    expect(requestAt(provider, 2)).toMatchObject({
      model: "claude-sonnet-5-5",
      effort: "medium",
      timeoutMs: 25000,
    });
  });

  it.each(["REFUSAL", "INVALID_OUTPUT", "TIMEOUT"] as const)(
    "advances the ladder on %s",
    async (code) => {
      const provider = useProvider([new LlmError(code), goodPlan()]);

      await generate();

      expect(provider.generateWorkoutPlan).toHaveBeenCalledTimes(2);
    },
  );

  it("fails with GENERATION_FAILED after three invalid results", async () => {
    const provider = useProvider([badPlan(), badPlan(), badPlan()]);

    const error = await generate().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ code: "GENERATION_FAILED" });
    expect(provider.generateWorkoutPlan).toHaveBeenCalledTimes(3);
    expect(prisma.workoutGeneration.update).toHaveBeenCalledWith({
      where: { id: GENERATION_ID },
      data: {
        status: "FAILED",
        attempts: 3,
        errorCode: "GENERATION_FAILED",
        completedAt: NOW,
      },
    });
  });

  it.each([
    ["RATE_LIMITED", "LLM_RATE_LIMITED"],
    ["UNAVAILABLE", "LLM_UNAVAILABLE"],
  ] as const)("stops immediately on %s", async (llmCode, errorCode) => {
    const provider = useProvider([new LlmError(llmCode), goodPlan()]);

    const error = await generate().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ code: errorCode });
    expect(provider.generateWorkoutPlan).toHaveBeenCalledTimes(1);
    expect(prisma.workoutGeneration.update).toHaveBeenCalledWith({
      where: { id: GENERATION_ID },
      data: expect.objectContaining({
        status: "FAILED",
        attempts: 1,
        errorCode,
      }),
    });
  });

  it("marks the row INTERNAL and rethrows a non-LLM error", async () => {
    const boom = new Error("boom");
    useProvider([boom]);

    await expect(generate()).rejects.toBe(boom);

    expect(prisma.workoutGeneration.update).toHaveBeenCalledWith({
      where: { id: GENERATION_ID },
      data: expect.objectContaining({
        status: "FAILED",
        errorCode: "INTERNAL",
      }),
    });
  });

  it("logs and still rethrows the original error if marking INTERNAL fails", async () => {
    const boom = new Error("boom");
    useProvider([boom]);
    prisma.workoutGeneration.update.mockRejectedValue(new Error("db down"));

    await expect(generate()).rejects.toBe(boom);

    expect(mockLog.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Failed to mark generation as failed",
    );
  });

  it("maps a missing API key to LLM_UNAVAILABLE", async () => {
    vi.mocked(getLlmProvider).mockImplementation(() => {
      throw new LlmError("UNAVAILABLE", "no key");
    });

    const error = await generate().catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "LLM_UNAVAILABLE" });
    expect(prisma.workoutGeneration.update).toHaveBeenCalledWith({
      where: { id: GENERATION_ID },
      data: expect.objectContaining({
        status: "FAILED",
        errorCode: "LLM_UNAVAILABLE",
      }),
    });
  });

  it("never logs the goal text", async () => {
    useProvider([goodPlan()]);

    await generate();

    expect(JSON.stringify(mockLog.info.mock.calls)).not.toContain(
      "get stronger",
    );
  });
});
