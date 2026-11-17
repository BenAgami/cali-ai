import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { API_ERROR_CODES } from "@repo/common";
import { ExerciseType, type getPrismaClient, ProcessingStatus } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createRecordedSet } from "../helpers/requestSender/recordedSetsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";
import { createWorkoutPlanFixture } from "../helpers/db/workoutPlanHelper";

import {
  RecordedSetBuilder,
  type RecordedSetDto,
} from "../builders/recordedSetBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("POST /api/recorded-sets", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  const registerReadyUser = async () => {
    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
      select: { id: true },
    });
    await grantAiPrerequisites(prisma, user.id);
    return { token: res.body.data.token as string, userId: user.id };
  };

  const registerPlainUser = async () => {
    const res = await registerUser(app, new RegisterUserBuilder().build());
    return res.body.data.token as string;
  };

  let pushUp: Awaited<ReturnType<typeof createExercise>>;
  let squat: Awaited<ReturnType<typeof createExercise>>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    pushUp = await createExercise(prisma, {
      code: "push_up",
      displayName: "Push Up",
      exerciseType: ExerciseType.DYNAMIC,
    });
    squat = await createExercise(prisma, {
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

  it("should create a recorded set successfully", async () => {
    const { token } = await registerReadyUser();

    const exercise = pushUp;
    const recordedSetDto: RecordedSetDto = new RecordedSetBuilder()
      .setExerciseCode(exercise.code)
      .build();

    const response = await createRecordedSet(app, token, recordedSetDto);

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data.processingStatus).toBe(ProcessingStatus.PENDING);
    expect(response.body.data.exercise.code).toBe(exercise.code);
    expect(response.body.data.notes).toBe(recordedSetDto.notes);
    expect(response.body.data.analysisStage).toBeNull();

    const storedRecordedSet = await prisma.recordedSet.findUnique({
      where: { id: response.body.data.id },
      include: { exercise: true },
    });

    expect(storedRecordedSet).not.toBeNull();
    expect(storedRecordedSet?.exercise.code).toBe(exercise.code);
    expect(storedRecordedSet?.processingStatus).toBe(ProcessingStatus.PENDING);
  });

  it("should return 401 if no token is provided", async () => {
    const response = await createRecordedSet(app, undefined, {
      exerciseCode: "push_up",
    });

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(response.body.message).toBe(
      "Authorization header missing or malformed",
    );
  });

  it("should return 400 for missing exerciseCode", async () => {
    const { token } = await registerReadyUser();

    const response = await createRecordedSet(app, token, {});

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("body.exerciseCode");
  });

  it("should return 400 for an exercise outside the supported four", async () => {
    const { token } = await registerReadyUser();

    const response = await createRecordedSet(app, token, {
      exerciseCode: "plank",
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("body.exerciseCode");
  });

  it("should return 404 when a supported exercise is not in the catalog", async () => {
    const { token } = await registerReadyUser();

    const response = await createRecordedSet(app, token, {
      exerciseCode: "dip",
    });

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
    expect(response.body.message).toBe("Exercise not found");
  });

  it("should return 428 when AI prerequisites are missing", async () => {
    const token = await registerPlainUser();

    const response = await createRecordedSet(app, token, {
      exerciseCode: "push_up",
    });

    expect(response.status).toBe(StatusCodes.PRECONDITION_REQUIRED);
    expect(response.body.code).toBe("PROFILE_INCOMPLETE");
  });

  it("should link the recorded set to an owned workout and set number", async () => {
    const { token, userId } = await registerReadyUser();
    const workout = await createWorkoutPlanFixture(prisma, {
      userId,
      exercises: [{ exerciseId: pushUp.id, position: 1 }],
    });

    const response = await createRecordedSet(app, token, {
      exerciseCode: "push_up",
      workoutPlanId: workout.id,
      setNumber: 2,
    });

    expect(response.status).toBe(StatusCodes.CREATED);
    expect(response.body.data.workoutPlanId).toBe(workout.id);
    expect(response.body.data.setNumber).toBe(2);
    expect(JSON.stringify(response.body)).not.toContain("formScore");
  });

  describe("workoutRunId", () => {
    const setup = async () => {
      const { token, userId } = await registerReadyUser();
      const workout = await createWorkoutPlanFixture(prisma, {
        userId,
        exercises: [{ exerciseId: pushUp.id, position: 1 }],
      });
      const run = await prisma.workoutRun.create({
        data: { userId, workoutPlanId: workout.id },
      });
      return { token, userId, workout, run };
    };

    it("should link the recorded set to an open run of that workout", async () => {
      const { token, workout, run } = await setup();

      const response = await createRecordedSet(app, token, {
        exerciseCode: "push_up",
        workoutPlanId: workout.id,
        workoutRunId: run.id,
        setNumber: 1,
      });

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.data.workoutRunId).toBe(run.id);
    });

    it("should return 400 for workoutRunId without workoutPlanId", async () => {
      const { token, run } = await setup();

      const response = await createRecordedSet(app, token, {
        exerciseCode: "push_up",
        workoutRunId: run.id,
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it("should return 404 for another user's run", async () => {
      const { workout, run } = await setup();
      const other = await registerReadyUser();

      const response = await createRecordedSet(app, other.token, {
        exerciseCode: "push_up",
        workoutPlanId: workout.id,
        workoutRunId: run.id,
      });

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });

    it("should return 409 when the run is already completed", async () => {
      const { token, workout, run } = await setup();
      await prisma.workoutRun.update({
        where: { id: run.id },
        data: { completedAt: new Date(), durationSecs: 60 },
      });

      const response = await createRecordedSet(app, token, {
        exerciseCode: "push_up",
        workoutPlanId: workout.id,
        workoutRunId: run.id,
      });

      expect(response.status).toBe(StatusCodes.CONFLICT);
      expect(response.body.code).toBe(API_ERROR_CODES.WORKOUT_RUN_COMPLETED);
    });
  });

  it("should return 404 for another user's workout", async () => {
    const owner = await registerReadyUser();
    const { token } = await registerReadyUser();
    const workout = await createWorkoutPlanFixture(prisma, {
      userId: owner.userId,
      exercises: [{ exerciseId: pushUp.id, position: 1 }],
    });

    const response = await createRecordedSet(app, token, {
      exerciseCode: "push_up",
      workoutPlanId: workout.id,
    });

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
    expect(response.body.message).toBe("Workout not found");
  });

  it("should return 400 when the exercise is not part of the workout", async () => {
    const { token, userId } = await registerReadyUser();
    const workout = await createWorkoutPlanFixture(prisma, {
      userId,
      exercises: [{ exerciseId: squat.id, position: 1 }],
    });

    const response = await createRecordedSet(app, token, {
      exerciseCode: "push_up",
      workoutPlanId: workout.id,
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.message).toBe("Exercise is not part of this workout");
  });

  it("should return 400 for setNumber without workoutPlanId", async () => {
    const { token } = await registerReadyUser();

    const response = await createRecordedSet(app, token, {
      exerciseCode: "push_up",
      setNumber: 1,
    });

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("should return 400 for invalid performedAt", async () => {
    const { token } = await registerReadyUser();

    const exercise = pushUp;
    const recordedSetDto: RecordedSetDto = new RecordedSetBuilder()
      .setExerciseCode(exercise.code)
      .setPerformedAt("not-a-date")
      .build();

    const response = await createRecordedSet(app, token, recordedSetDto);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.details[0].message).toContain("body.performedAt");
  });
});
