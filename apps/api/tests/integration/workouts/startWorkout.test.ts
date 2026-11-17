import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { type getPrismaClient, SessionStatus } from "@repo/db";

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

describe("workout runs: POST/PATCH /api/workouts/:id/runs", () => {
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

      const dbRun = await prisma.workoutRun.findUniqueOrThrow({
        where: { id: response.body.data.id },
      });
      expect(dbRun.completedAt).toBeNull();
    });

    it("resumes the open run when the plan is started again", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);

      const first = await startWorkout(app, token, workout.id);
      const second = await startWorkout(app, token, workout.id);

      expect(second.status).toBe(StatusCodes.CREATED);
      expect(second.body.data.id).toBe(first.body.data.id);
    });

    it("opens a new run once the previous one is completed", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const first = await startWorkout(app, token, workout.id);
      await completeWorkout(app, token, workout.id, first.body.data.id, {});

      const second = await startWorkout(app, token, workout.id);

      expect(second.body.data.id).not.toBe(first.body.data.id);
    });

    it("drops a stale open run with no sets and keeps one with a processing set", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const stale = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const empty = await prisma.workoutRun.create({
        data: { userId, workoutId: workout.id, startedAt: stale },
      });
      const withSet = await prisma.workoutRun.create({
        data: { userId, workoutId: workout.id, startedAt: stale },
      });
      await prisma.workoutSession.create({
        data: {
          userId,
          exerciseId,
          workoutId: workout.id,
          workoutRunId: withSet.id,
          processingStatus: SessionStatus.PROCESSING,
        },
      });

      const response = await startWorkout(app, token, workout.id);

      expect(response.body.data.id).not.toBe(withSet.id);
      expect(
        await prisma.workoutRun.findUnique({ where: { id: empty.id } }),
      ).toBeNull();
      expect(
        await prisma.workoutRun.findUnique({ where: { id: withSet.id } }),
      ).not.toBeNull();
    });

    it("drops a stale open run whose only session never had a capture accepted", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const run = await prisma.workoutRun.create({
        data: { userId, workoutId: workout.id },
      });
      const session = await prisma.workoutSession.create({
        data: {
          userId,
          exerciseId,
          workoutId: workout.id,
          workoutRunId: run.id,
          processingStatus: SessionStatus.PENDING,
        },
      });
      await prisma.workoutRun.update({
        where: { id: run.id },
        data: { startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      });

      await startWorkout(app, token, workout.id);

      expect(
        await prisma.workoutRun.findUnique({ where: { id: run.id } }),
      ).toBeNull();
      const detached = await prisma.workoutSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(detached.workoutRunId).toBeNull();
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
    it("records the completion time and a duration from startedAt", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const run = await prisma.workoutRun.create({
        data: {
          userId,
          workoutId: workout.id,
          startedAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      });

      // A client-sent duration is ignored.
      const response = await completeWorkout(app, token, workout.id, run.id, {
        durationSecs: 5,
      });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.data.durationSecs).toBeGreaterThanOrEqual(1800);
      expect(response.body.data.durationSecs).toBeLessThan(1860);
      expect(typeof response.body.data.completedAt).toBe("string");
    });

    it("returns 409 when the run is already completed", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const started = await startWorkout(app, token, workout.id);
      const runId = started.body.data.id;
      await completeWorkout(app, token, workout.id, runId, {});

      const response = await completeWorkout(app, token, workout.id, runId, {});

      expect(response.status).toBe(StatusCodes.CONFLICT);
    });

    it("completes a run only once when two requests race", async () => {
      const { userId, token } = await newUser();
      const workout = await newWorkout(userId);
      const started = await startWorkout(app, token, workout.id);
      const runId = started.body.data.id;

      const responses = await Promise.all([
        completeWorkout(app, token, workout.id, runId, {}),
        completeWorkout(app, token, workout.id, runId, {}),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        StatusCodes.OK,
        StatusCodes.CONFLICT,
      ]);
      const winner = responses.find((response) => response.body.success)!;
      const dbRun = await prisma.workoutRun.findUniqueOrThrow({
        where: { id: runId },
      });
      expect(dbRun.durationSecs).toBe(winner.body.data.durationSecs);
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
        {},
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
        {},
      );

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });
  });
});
