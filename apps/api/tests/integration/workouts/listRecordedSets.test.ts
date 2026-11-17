import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { type getPrismaClient, ProcessingStatus } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { getRecordedSets } from "../helpers/requestSender/workoutPlansRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { createWorkoutPlanFixture } from "../helpers/db/workoutPlanHelper";

import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("GET /api/workout-plans/:id/recorded-sets", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let exerciseId: number;

  const newUser = async () => {
    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
      select: { id: true },
    });
    return { userId: user.id, token: res.body.data.token as string };
  };

  const newWorkoutPlan = (userId: number) =>
    createWorkoutPlanFixture(prisma, {
      userId,
      exercises: [{ exerciseId, position: 1 }],
    });

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    exerciseId = (await createExercise(prisma, { code: "push_up" })).id;
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("lists recorded sets newest first with status, outcome and band, without formScore", async () => {
    const { userId, token } = await newUser();
    const workout = await newWorkoutPlan(userId);
    const older = await prisma.recordedSet.create({
      data: {
        userId,
        exerciseId,
        workoutPlanId: workout.id,
        setNumber: 1,
        performedAt: new Date("2026-11-09T10:00:00Z"),
        processingStatus: ProcessingStatus.COMPLETED,
        analysisResult: {
          create: { outcome: "SCORED", formScore: 91 },
        },
      },
      select: { id: true },
    });
    const newer = await prisma.recordedSet.create({
      data: {
        userId,
        exerciseId,
        workoutPlanId: workout.id,
        setNumber: 2,
        performedAt: new Date("2026-11-09T10:05:00Z"),
        processingStatus: ProcessingStatus.PROCESSING,
        analysisStage: "ANALYZING_REPS",
      },
      select: { id: true },
    });

    const response = await getRecordedSets(app, token, workout.id);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toMatchObject({
      recordedSetId: newer.id,
      processingStatus: "PROCESSING",
      analysisStage: "ANALYZING_REPS",
      outcome: null,
      band: null,
    });
    expect(response.body.data.items[1]).toMatchObject({
      recordedSetId: older.id,
      outcome: "SCORED",
      band: "EXCELLENT",
    });
    expect(JSON.stringify(response.body)).not.toContain("formScore");
  });

  it("filters to one run when workoutRunId is given and exposes workoutRunId", async () => {
    const { userId, token } = await newUser();
    const workout = await newWorkoutPlan(userId);
    const runA = await prisma.workoutRun.create({
      data: { userId, workoutPlanId: workout.id },
    });
    const runB = await prisma.workoutRun.create({
      data: { userId, workoutPlanId: workout.id },
    });
    const inRunA = await prisma.recordedSet.create({
      data: {
        userId,
        exerciseId,
        workoutPlanId: workout.id,
        workoutRunId: runA.id,
        setNumber: 1,
        processingStatus: ProcessingStatus.PROCESSING,
      },
      select: { id: true },
    });
    await prisma.recordedSet.create({
      data: {
        userId,
        exerciseId,
        workoutPlanId: workout.id,
        workoutRunId: runB.id,
        setNumber: 1,
        processingStatus: ProcessingStatus.PROCESSING,
      },
    });

    const all = await getRecordedSets(app, token, workout.id);
    const filtered = await getRecordedSets(app, token, workout.id, {
      workoutRunId: runA.id,
    });

    expect(all.body.data.items).toHaveLength(2);
    expect(filtered.status).toBe(StatusCodes.OK);
    expect(filtered.body.data.items).toHaveLength(1);
    expect(filtered.body.data.items[0]).toMatchObject({
      recordedSetId: inRunA.id,
      workoutRunId: runA.id,
    });
  });

  it("omits PENDING recorded sets, which never received a capture", async () => {
    const { userId, token } = await newUser();
    const workout = await newWorkoutPlan(userId);
    await prisma.recordedSet.create({
      data: {
        userId,
        exerciseId,
        workoutPlanId: workout.id,
        setNumber: 1,
        processingStatus: ProcessingStatus.PENDING,
      },
    });
    const processing = await prisma.recordedSet.create({
      data: {
        userId,
        exerciseId,
        workoutPlanId: workout.id,
        setNumber: 2,
        processingStatus: ProcessingStatus.PROCESSING,
      },
      select: { id: true },
    });

    const response = await getRecordedSets(app, token, workout.id);

    expect(
      response.body.data.items.map(
        (set: { recordedSetId: number }) => set.recordedSetId,
      ),
    ).toEqual([processing.id]);
  });

  it("returns an empty list for a workout with no recorded sets", async () => {
    const { userId, token } = await newUser();
    const workout = await newWorkoutPlan(userId);

    const response = await getRecordedSets(app, token, workout.id);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.page.hasMore).toBe(false);
  });

  it("pages with limit and offset and reports hasMore and nextOffset", async () => {
    const { userId, token } = await newUser();
    const workout = await newWorkoutPlan(userId);
    for (const setNumber of [1, 2, 3]) {
      await prisma.recordedSet.create({
        data: {
          userId,
          exerciseId,
          workoutPlanId: workout.id,
          setNumber,
          performedAt: new Date(`2026-11-09T10:0${setNumber}:00Z`),
          processingStatus: ProcessingStatus.PROCESSING,
        },
      });
    }

    const first = await getRecordedSets(app, token, workout.id, { limit: 2 });
    const second = await getRecordedSets(app, token, workout.id, {
      limit: 2,
      offset: 2,
    });

    expect(first.status).toBe(StatusCodes.OK);
    expect(first.body.data.items).toHaveLength(2);
    expect(first.body.data.page).toMatchObject({
      hasMore: true,
      nextOffset: 2,
    });
    expect(second.body.data.items).toHaveLength(1);
    expect(second.body.data.page).toMatchObject({
      hasMore: false,
      nextOffset: null,
    });
  });

  it("defaults the page size to 50", async () => {
    const { userId, token } = await newUser();
    const workout = await newWorkoutPlan(userId);

    const response = await getRecordedSets(app, token, workout.id);

    expect(response.body.data.page).toMatchObject({ limit: 50, offset: 0 });
  });

  it.each<Record<string, number>>([
    { limit: 101 },
    { limit: 0 },
    { offset: -1 },
  ])("returns 400 for invalid paging %j", async (query) => {
    const { userId, token } = await newUser();
    const workout = await newWorkoutPlan(userId);

    const response = await getRecordedSets(app, token, workout.id, query);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("returns 404 for another user's workout", async () => {
    const owner = await newUser();
    const other = await newUser();
    const workout = await newWorkoutPlan(owner.userId);

    const response = await getRecordedSets(app, other.token, workout.id);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 401 without a token", async () => {
    const response = await getRecordedSets(app, undefined, 1);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
