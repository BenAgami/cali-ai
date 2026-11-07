import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { ExerciseType, type getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { createWorkout } from "../helpers/requestSender/workoutsRequests";
import { WorkoutBuilder } from "../builders/workoutBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("POST /api/workouts", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should create a workout with one dynamic exercise", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const exercise = await createExercise(prisma, {
      exerciseType: ExerciseType.DYNAMIC,
    });
    const workoutDto = new WorkoutBuilder()
      .setExercises([
        { exerciseId: exercise.id, sets: 3, reps: 10, restSecs: 60 },
      ])
      .build();

    const response = await createWorkout(app, token, workoutDto);

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.id).toBe("number");
    expect(response.body.data.name).toBe("Push Day");
    expect(response.body.data.exercises).toHaveLength(1);
    expect(response.body.data.exercises[0].position).toBe(0);
    expect(response.body.data.exercises[0].sets).toBe(3);
    expect(response.body.data.exercises[0].reps).toBe(10);
    expect(response.body.data.aiModel).toBeNull();
    expect(response.body.data.generationId).toBeNull();

    const dbExercises = await prisma.workoutExercise.findMany({
      where: { workoutId: response.body.data.id },
    });
    expect(dbExercises).toHaveLength(1);
    expect(dbExercises[0].position).toBe(0);
  });

  it("should create a workout with multiple exercises in declared order", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const ex1 = await createExercise(prisma);
    const ex2 = await createExercise(prisma);
    const ex3 = await createExercise(prisma);

    const workoutDto = new WorkoutBuilder()
      .setExercises([
        { exerciseId: ex1.id, sets: 3, reps: 5, restSecs: 60 },
        { exerciseId: ex2.id, sets: 3, reps: 8, restSecs: 60 },
        { exerciseId: ex3.id, sets: 3, reps: 12, restSecs: 60 },
      ])
      .build();

    const response = await createWorkout(app, token, workoutDto);

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.data.exercises).toHaveLength(3);
    expect(response.body.data.exercises[0].position).toBe(0);
    expect(response.body.data.exercises[0].reps).toBe(5);
    expect(response.body.data.exercises[1].position).toBe(1);
    expect(response.body.data.exercises[1].reps).toBe(8);
    expect(response.body.data.exercises[2].position).toBe(2);
    expect(response.body.data.exercises[2].reps).toBe(12);
  });

  it("should accept Static Hold exercise with durationSecs (no reps)", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const exercise = await createExercise(prisma, {
      exerciseType: ExerciseType.STATIC_HOLD,
    });
    const workoutDto = new WorkoutBuilder()
      .setExercises([
        { exerciseId: exercise.id, sets: 3, durationSecs: 30, restSecs: 60 },
      ])
      .build();

    const response = await createWorkout(app, token, workoutDto);

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.data.exercises[0].durationSecs).toBe(30);
    expect(response.body.data.exercises[0].reps).toBeNull();
  });

  it("should return 401 without auth token", async () => {
    const exercise = await createExercise(prisma);
    const workoutDto = new WorkoutBuilder()
      .setExercises([
        { exerciseId: exercise.id, sets: 3, reps: 10, restSecs: 60 },
      ])
      .build();

    const response = await createWorkout(app, undefined, workoutDto);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("should return 400 for missing name", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const exercise = await createExercise(prisma);
    const response = await createWorkout(app, token, {
      exercises: [{ exerciseId: exercise.id, sets: 3, reps: 10, restSecs: 60 }],
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("body.name");
  });

  it("should return 400 for empty exercises array", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const response = await createWorkout(app, token, {
      name: "X",
      exercises: [],
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("body.exercises");
  });

  it("should return 400 for invalid exerciseId (not a number)", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const response = await createWorkout(app, token, {
      name: "X",
      exercises: [{ exerciseId: "abc", sets: 3, reps: 10, restSecs: 60 }],
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should return 404 for non-existent exerciseId", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const workoutDto = new WorkoutBuilder()
      .setExercises([{ exerciseId: 999999, sets: 3, reps: 10, restSecs: 60 }])
      .build();

    const response = await createWorkout(app, token, workoutDto);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
    expect(response.body.message).toContain("Exercise");
  });
});
