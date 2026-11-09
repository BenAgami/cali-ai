import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { type getPrismaClient, SessionStatus } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { registerUser } from "../helpers/requestSender/authRequests";
import { getSessionAnalysis } from "../helpers/requestSender/sessionsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";

import { RegisterUserBuilder } from "../builders/registerUserBuilder";

describe("GET /api/sessions/:id/analysis", () => {
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

  const seedScored = async (userId: number) => {
    const session = await prisma.workoutSession.create({
      data: {
        userId,
        exerciseId,
        setNumber: 1,
        processingStatus: SessionStatus.COMPLETED,
        analysisResult: {
          create: {
            outcome: "SCORED",
            formScore: 82,
            scoreBreakdown: {
              ROM: { score: 88, isAssessed: true },
              CORE: { score: 76, isAssessed: true },
              SYMMETRY: { score: null, isAssessed: false },
            },
            summaryFeedback: "Solid set.",
            rawFeedback: {
              metricsVersion: "1",
              rubricVersion: "1",
              promptVersion: "1",
              repCount: 8,
              droppedRepCount: 0,
              reps: [],
              llmUsage: null,
            },
            findings: {
              create: [
                {
                  findingType: "POSITIVE",
                  title: "What went well",
                  description: "Good depth",
                  sortOrder: 0,
                  repNumbers: [1, 2],
                },
                {
                  findingType: "CORRECTION",
                  severity: "HIGH",
                  code: "HIPS_SAG",
                  title: "Hips sag",
                  description: "Hips dropped late",
                  correction: "Squeeze your glutes",
                  sortOrder: 0,
                  repNumbers: [6],
                },
              ],
            },
          },
        },
      },
      select: { id: true },
    });
    return session.id;
  };

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    exerciseId = (await createExercise(prisma, { code: "push_up" })).id;
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  it("returns the scored result without exposing formScore", async () => {
    const { userId, token } = await newUser();
    const sessionId = await seedScored(userId);

    const response = await getSessionAnalysis(app, token, sessionId);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data).toMatchObject({
      sessionId,
      outcome: "SCORED",
      band: "GOOD",
      repCount: 8,
      positives: [{ text: "Good depth", repNumbers: [1, 2] }],
      corrections: [{ code: "HIPS_SAG", cue: "Squeeze your glutes" }],
    });
    expect(response.body.data.dimensions).toEqual([
      { dimension: "ROM", band: "GOOD", isAssessed: true },
      { dimension: "CORE", band: "GOOD", isAssessed: true },
      { dimension: "SYMMETRY", band: null, isAssessed: false },
    ]);
    expect(JSON.stringify(response.body)).not.toContain("formScore");
  });

  it("returns reasons and advice for an untrackable set", async () => {
    const { userId, token } = await newUser();
    const session = await prisma.workoutSession.create({
      data: {
        userId,
        exerciseId,
        processingStatus: SessionStatus.COMPLETED,
        analysisResult: {
          create: {
            outcome: "UNTRACKABLE",
            untrackableReasons: ["WRONG_VIEW"],
          },
        },
      },
      select: { id: true },
    });

    const response = await getSessionAnalysis(app, token, session.id);

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.data.outcome).toBe("UNTRACKABLE");
    expect(response.body.data.reasons).toEqual(["WRONG_VIEW"]);
    expect(response.body.data.advice.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain("formScore");
  });

  it("returns 409 ANALYSIS_NOT_READY while PROCESSING", async () => {
    const { userId, token } = await newUser();
    const session = await prisma.workoutSession.create({
      data: {
        userId,
        exerciseId,
        processingStatus: SessionStatus.PROCESSING,
      },
      select: { id: true },
    });

    const response = await getSessionAnalysis(app, token, session.id);

    expect(response.status).toBe(StatusCodes.CONFLICT);
    expect(response.body.code).toBe("ANALYSIS_NOT_READY");
  });

  it("returns 404 for another user's session", async () => {
    const owner = await newUser();
    const other = await newUser();
    const sessionId = await seedScored(owner.userId);

    const response = await getSessionAnalysis(app, other.token, sessionId);

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 401 without a token", async () => {
    const response = await getSessionAnalysis(app, undefined, 1);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
