import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { ExerciseType, type getPrismaClient } from "@repo/db";
import { AI_CONSENT_VERSION } from "@repo/common";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import {
  patchMyProfile,
  postMyAiConsent,
  postMyBodyMetrics,
  postMyGoal,
} from "../helpers/requestSender/usersRequests";
import {
  createWorkout,
  getWorkout,
  postGenerateWorkout,
} from "../helpers/requestSender/workoutsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

const { generateWorkoutPlan } = vi.hoisted(() => ({
  generateWorkoutPlan: vi.fn(),
}));

vi.mock("../../../src/lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/llm")>()),
  getLlmProvider: () => ({ generateWorkoutPlan }),
}));

const MODEL = "claude-haiku-5-5";
const GOAL = { goalText: "Build basic strength" };

const validResult = () => ({
  plan: {
    name: "Beginner Strength",
    note: null,
    exercises: [
      {
        exerciseCode: "push_up",
        sets: 3,
        reps: 10,
        durationSecs: null,
        restSecs: 90,
      },
      {
        exerciseCode: "squat",
        sets: 3,
        reps: 12,
        durationSecs: null,
        restSecs: 90,
      },
      {
        exerciseCode: "plank",
        sets: 3,
        reps: null,
        durationSecs: 20,
        restSecs: 60,
      },
    ],
  },
  model: MODEL,
  usage: { inputTokens: 100, outputTokens: 100 },
});

const invalidResult = () => {
  const result = validResult();
  result.plan.exercises = result.plan.exercises.map((e) => ({
    ...e,
    exerciseCode: "handstand",
  }));
  return result;
};

describe("POST /api/workouts/generate", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  const registerFresh = async () => {
    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    return { token: res.body.data.token as string, email: dto.email! };
  };

  const completeProfile = async (token: string) => {
    await patchMyProfile(app, { experienceLevel: "BEGINNER" }, token);
    await postMyGoal(
      app,
      { goalType: "STRENGTH", title: "Get stronger" },
      token,
    );
  };

  const makeReadyUser = async () => {
    const user = await registerFresh();
    await completeProfile(user.token);
    await postMyBodyMetrics(app, { heightCm: 180, weightKg: 75 }, user.token);
    await postMyAiConsent(app, { version: AI_CONSENT_VERSION }, user.token);
    return user;
  };

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    await createExercise(prisma, {
      code: "push_up",
      displayName: "Push Up",
      exerciseType: ExerciseType.DYNAMIC,
    });
    await createExercise(prisma, {
      code: "squat",
      displayName: "Squat",
      exerciseType: ExerciseType.DYNAMIC,
    });
    await createExercise(prisma, {
      code: "plank",
      displayName: "Plank",
      exerciseType: ExerciseType.STATIC_HOLD,
    });
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  beforeEach(() => {
    generateWorkoutPlan.mockReset();
  });

  it("returns a preview and records a SUCCEEDED generation", async () => {
    const { token } = await makeReadyUser();
    generateWorkoutPlan.mockResolvedValue(validResult());

    const res = await postGenerateWorkout(app, GOAL, token);

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.data.exercises).toHaveLength(3);
    expect(
      res.body.data.exercises.map(
        (e: { exercise: { code: string } }) => e.exercise.code,
      ),
    ).toEqual(["push_up", "squat", "plank"]);
    expect(typeof res.body.data.generationId).toBe("number");

    const row = await prisma.workoutGeneration.findUniqueOrThrow({
      where: { id: res.body.data.generationId },
    });
    expect(row.status).toBe("SUCCEEDED");
    expect(row.model).toBe(MODEL);
    expect(row.promptVersion).toBe("workout-plan-v1");
  });

  it("returns 503 GENERATION_FAILED when every attempt is invalid", async () => {
    const { token, email } = await makeReadyUser();
    generateWorkoutPlan.mockResolvedValue(invalidResult());

    const res = await postGenerateWorkout(app, GOAL, token);

    expect(res.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    expect(res.body.code).toBe("GENERATION_FAILED");
    expect(JSON.stringify(res.body)).not.toContain("handstand");

    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    const row = await prisma.workoutGeneration.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(row.status).toBe("FAILED");
    expect(row.attempts).toBe(3);
  });

  it("returns 428 for each missing prerequisite without calling the LLM", async () => {
    const fresh = await registerFresh();

    const first = await postGenerateWorkout(app, GOAL, fresh.token);
    expect(first.status).toBe(StatusCodes.PRECONDITION_REQUIRED);
    expect(first.body.code).toBe("PROFILE_INCOMPLETE");

    await completeProfile(fresh.token);
    const second = await postGenerateWorkout(app, GOAL, fresh.token);
    expect(second.status).toBe(StatusCodes.PRECONDITION_REQUIRED);
    expect(second.body.code).toBe("BODY_METRICS_REQUIRED");

    await postMyBodyMetrics(app, { heightCm: 180, weightKg: 75 }, fresh.token);
    const third = await postGenerateWorkout(app, GOAL, fresh.token);
    expect(third.status).toBe(StatusCodes.PRECONDITION_REQUIRED);
    expect(third.body.code).toBe("AI_CONSENT_REQUIRED");

    expect(generateWorkoutPlan).not.toHaveBeenCalled();
  });

  it("returns 429 DAILY_LIMIT_REACHED once the cap is used", async () => {
    const { token, email } = await makeReadyUser();
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    await prisma.workoutGeneration.createMany({
      data: Array.from({ length: 10 }, () => ({
        userId: user.id,
        status: "FAILED" as const,
        goalText: "old",
        promptVersion: "workout-plan-v1",
      })),
    });

    const res = await postGenerateWorkout(app, GOAL, token);

    expect(res.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
    expect(res.body.code).toBe("DAILY_LIMIT_REACHED");
    expect(generateWorkoutPlan).not.toHaveBeenCalled();
  });

  it("rejects an empty goalText with 400 and a missing token with 401", async () => {
    const { token } = await registerFresh();

    const bad = await postGenerateWorkout(app, { goalText: "" }, token);
    expect(bad.status).toBe(StatusCodes.BAD_REQUEST);

    const noAuth = await postGenerateWorkout(app, GOAL);
    expect(noAuth.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("saves a preview with provenance and rejects reuse", async () => {
    const { token } = await makeReadyUser();
    generateWorkoutPlan.mockResolvedValue(validResult());
    const preview = (await postGenerateWorkout(app, GOAL, token)).body.data;

    const body = {
      name: preview.name,
      generationId: preview.generationId,
      exercises: preview.exercises.map(
        (e: {
          exerciseId: number;
          sets: number;
          reps: number | null;
          durationSecs: number | null;
          restSecs: number;
        }) => ({
          exerciseId: e.exerciseId,
          sets: e.sets,
          reps: e.reps ?? undefined,
          durationSecs: e.durationSecs ?? undefined,
          restSecs: e.restSecs,
        }),
      ),
    };

    const saved = await createWorkout(app, token, body);
    expect(saved.status).toBe(StatusCodes.CREATED);
    expect(saved.body.data.aiModel).toBe(MODEL);
    expect(saved.body.data.generationId).toBe(preview.generationId);

    const detail = await getWorkout(app, token, saved.body.data.id);
    expect(detail.body.data.aiModel).toBe(MODEL);

    const again = await createWorkout(app, token, body);
    expect(again.status).toBe(StatusCodes.CONFLICT);
    expect(again.body.code).toBe("GENERATION_ALREADY_SAVED");

    const other = await registerFresh();
    const foreign = await createWorkout(app, other.token, body);
    expect(foreign.status).toBe(StatusCodes.NOT_FOUND);
  });
});
