import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";
import { analysisStatusEventSchema } from "@repo/common";

import { startWorkers, stopWorkers } from "../../../src/workers";

import { buildSyntheticCapture } from "../../unit/helpers/syntheticPose";
import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { closeQueueConnections, resetAnalysisQueue } from "../helpers/queue";
import { openSse, type SseConnection } from "../helpers/sseClient";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createWorkoutSession } from "../helpers/requestSender/workoutSessionsRequests";
import {
  getSessionAnalysis,
  submitCapture,
} from "../helpers/requestSender/sessionsRequests";
import { getRecordedSets } from "../helpers/requestSender/workoutsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";
import { createWorkoutFixture } from "../helpers/db/workoutHelper";

import { RegisterUserBuilder } from "../builders/registerUserBuilder";

const { generateFormFeedback } = vi.hoisted(() => ({
  generateFormFeedback: vi.fn(),
}));

// The LLM is an external I/O boundary; Postgres and Redis stay real.
vi.mock("../../../src/lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/llm")>()),
  getLlmProvider: () => ({ generateFormFeedback }),
}));

describe("recorded set analysis result flow (FORM-08)", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let server: Server;
  let baseUrl: string;
  let token: string;
  let userId: number;
  let exerciseId: number;
  const connections: SseConnection[] = [];

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    token = res.body.data.token as string;
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
      select: { id: true },
    });
    userId = user.id;
    await grantAiPrerequisites(prisma, userId);
    exerciseId = (await createExercise(prisma, { code: "push_up" })).id;

    await resetAnalysisQueue();
    await startWorkers();
  });

  beforeEach(() => {
    generateFormFeedback.mockReset();
    generateFormFeedback.mockResolvedValue({
      feedback: {
        summary: "Steady, controlled set.",
        positives: [{ text: "Your tempo stayed steady", repNumbers: [1, 2] }],
        corrections: [],
      },
      model: "claude-sonnet-5-5",
      usage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  afterEach(() => {
    connections.splice(0).forEach((c) => c.close());
  });

  afterAll(async () => {
    await stopWorkers();
    await resetAnalysisQueue();
    await new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    });
    await teardownIntegrationTest(prisma);
    await closeQueueConnections();
  });

  it("goes from capture to a stored result readable over HTTP", async () => {
    const workout = await createWorkoutFixture(prisma, {
      userId,
      exercises: [{ exerciseId, position: 1 }],
    });

    const created = await createWorkoutSession(app, token, {
      exerciseCode: "push_up",
      workoutId: workout.id,
      setNumber: 1,
    });
    expect(created.status).toBe(StatusCodes.CREATED);
    const sessionId = created.body.data.id as number;

    const accepted = await submitCapture(
      app,
      token,
      sessionId,
      buildSyntheticCapture({ exercise: "push_up", reps: 5 }),
    );
    expect(accepted.status).toBe(StatusCodes.ACCEPTED);

    const connection = await openSse(
      baseUrl,
      `/api/sessions/${sessionId}/status`,
      token,
    );
    connections.push(connection);
    await vi.waitFor(
      () => {
        const statuses = connection.events.map(
          (e) => analysisStatusEventSchema.parse(e.data).status,
        );
        expect(statuses).toContain("COMPLETED");
      },
      { timeout: 20_000, interval: 100 },
    );

    const analysis = await getSessionAnalysis(app, token, sessionId);
    expect(analysis.status).toBe(StatusCodes.OK);
    expect(analysis.body.data).toMatchObject({
      sessionId,
      outcome: "SCORED",
      repCount: 5,
    });
    expect(analysis.body.data.band).toEqual(expect.any(String));
    expect(analysis.body.data.dimensions).toHaveLength(3);
    expect(analysis.body.data.dimensions).toContainEqual({
      dimension: "SYMMETRY",
      band: null,
      isAssessed: false,
    });
    expect(analysis.body.data.positives.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(analysis.body)).not.toContain("formScore");

    const recorded = await getRecordedSets(app, token, workout.id);
    expect(recorded.status).toBe(StatusCodes.OK);
    expect(recorded.body.data).toHaveLength(1);
    expect(recorded.body.data[0]).toMatchObject({
      sessionId,
      setNumber: 1,
      outcome: "SCORED",
      band: analysis.body.data.band,
    });
    expect(JSON.stringify(recorded.body)).not.toContain("formScore");
  });
});
