import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import {
  completeWorkout,
  startWorkout,
} from "../helpers/requestSender/workoutsRequests";
import { createWorkoutFixture } from "../helpers/db/workoutHelper";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("workout runs: POST/PATCH /api/workouts/:id/logs", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let exerciseId: number;

  const newUser = async () => {
    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email!.toLowerCase() },
      select: { id: true },
    });
    return { userId: user.id, token: res.body.data.token as string };
  };

  const newWorkout = (userId: number) =>
    createWorkoutFixture(prisma, {
      userId,
      name: "My Workout",
      exercises: [{ exerciseId, position: 0 }],
    });

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    exerciseId = (await createExercise(prisma)).id;
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  describe("POST (start a run)", () => {
    it("creates an in-progress run linked to the workout", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);

      const response = await startWorkout(app, token, workout.id);

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.data.workoutId).toBe(workout.id);
      expect(typeof response.body.data.startedAt).toBe("string");
      expect(response.body.data.completedAt).toBeNull();
      expect(response.body.data.durationSecs).toBeNull();

      const dbLog = await prisma.workoutLog.findUniqueOrThrow({
        where: { id: response.body.data.id },
      });
      expect(dbLog.completedAt).toBeNull();
    });

    it("lets the same plan be started again as a new run", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);

      const first = await startWorkout(app, token, workout.id);
      const second = await startWorkout(app, token, workout.id);

      expect(second.status).toBe(StatusCodes.CREATED);
      expect(second.body.data.id).not.toBe(first.body.data.id);
    });

    it("returns 404 for another user's workout", async () => {
      const owner = await newUser();
      const other = await newUser();
      const workout = await newWorkout(owner.userId);

      const response = await startWorkout(app, other.token, workout.id);

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });

    it("returns 404 for a non-existent workout id", async () => {
      const { token } = await newUser();

      const response = await startWorkout(app, token, 999999);

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });

    it("returns 401 without an auth token", async () => {
      const response = await startWorkout(app, undefined, 1);

      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("PATCH (complete a run)", () => {
    it("records the duration and completion time", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const started = await startWorkout(app, token, workout.id);

      const response = await completeWorkout(
        app,
        token,
        workout.id,
        started.body.data.id,
        { durationSecs: 1800 },
      );

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.data.durationSecs).toBe(1800);
      expect(typeof response.body.data.completedAt).toBe("string");
    });

    it("returns 409 when the run is already completed", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const started = await startWorkout(app, token, workout.id);
      const logId = started.body.data.id;
      await completeWorkout(app, token, workout.id, logId, {
        durationSecs: 60,
      });

      const response = await completeWorkout(app, token, workout.id, logId, {
        durationSecs: 90,
      });

      expect(response.status).toBe(StatusCodes.CONFLICT);
    });

    it("completes a run only once when two requests race", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const started = await startWorkout(app, token, workout.id);
      const logId = started.body.data.id;

      const responses = await Promise.all([
        completeWorkout(app, token, workout.id, logId, { durationSecs: 60 }),
        completeWorkout(app, token, workout.id, logId, { durationSecs: 90 }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        StatusCodes.OK,
        StatusCodes.CONFLICT,
      ]);
      const winner = responses.find((response) => response.body.success)!;
      const dbLog = await prisma.workoutLog.findUniqueOrThrow({
        where: { id: logId },
      });
      expect(dbLog.durationSecs).toBe(winner.body.data.durationSecs);
    });

    it("returns 404 for another user's run", async () => {
      const owner = await newUser();
      const other = await newUser();
      const workout = await newWorkout(owner.userId);
      const started = await startWorkout(app, owner.token, workout.id);

      const response = await completeWorkout(
        app,
        other.token,
        workout.id,
        started.body.data.id,
        { durationSecs: 60 },
      );

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });

    it("returns 404 when the run belongs to a different workout", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const otherWorkout = await newWorkout(userId);
      const started = await startWorkout(app, token, workout.id);

      const response = await completeWorkout(
        app,
        token,
        otherWorkout.id,
        started.body.data.id,
        { durationSecs: 60 },
      );

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });

    it("returns 400 for a negative durationSecs", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const started = await startWorkout(app, token, workout.id);

      const response = await completeWorkout(
        app,
        token,
        workout.id,
        started.body.data.id,
        { durationSecs: -5 },
      );

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });
});
