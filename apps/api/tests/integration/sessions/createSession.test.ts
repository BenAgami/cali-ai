import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient, SessionStatus } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createWorkoutSession } from "../helpers/requestSender/sessionsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";

import {
  WorkoutSessionBuilder,
  WorkoutSessionDto,
} from "../builders/workoutSessionBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("POST /api/sessions", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("should create a workout session successfully", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const exercise = await createExercise(prisma);
    const sessionDto: WorkoutSessionDto = new WorkoutSessionBuilder()
      .setExerciseCode(exercise.code)
      .build();

    const response = await createWorkoutSession(app, token, sessionDto);

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data.processingStatus).toBe(SessionStatus.PENDING);
    expect(response.body.data.exercise.code).toBe(exercise.code);
    expect(response.body.data.notes).toBe(sessionDto.notes);
    expect(Number(response.body.data.videoDurationSec)).toBe(
      sessionDto.videoMeta?.durationSec,
    );

    const storedSession = await prisma.workoutSession.findUnique({
      where: { id: response.body.data.id },
      include: { exercise: true },
    });

    expect(storedSession).not.toBeNull();
    expect(storedSession?.exercise.code).toBe(exercise.code);
    expect(storedSession?.processingStatus).toBe(SessionStatus.PENDING);
  });

  it("should return 401 if no token is provided", async () => {
    const response = await createWorkoutSession(app, undefined, {
      exerciseCode: "push_up",
    });

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(response.body.message).toBe(
      "Authorization header missing or malformed",
    );
  });

  it("should return 400 for missing exerciseCode", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const response = await createWorkoutSession(app, token, {});

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("body.exerciseCode");
  });

  it("should return 404 for unknown exercise code", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const sessionDto: WorkoutSessionDto = new WorkoutSessionBuilder()
      .setExerciseCode("non_existing_exercise")
      .build();

    const response = await createWorkoutSession(app, token, sessionDto);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
    expect(response.body.message).toBe("Exercise not found");
  });

  it("should return 400 for invalid performedAt", async () => {
    const registerUserDto = new RegisterUserBuilder().build();
    const registerRes = await registerUser(app, registerUserDto);
    const token = registerRes.body.data.token;

    const exercise = await createExercise(prisma);
    const sessionDto: WorkoutSessionDto = new WorkoutSessionBuilder()
      .setExerciseCode(exercise.code)
      .setPerformedAt("not-a-date")
      .build();

    const response = await createWorkoutSession(app, token, sessionDto);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("body.performedAt");
  });
});
