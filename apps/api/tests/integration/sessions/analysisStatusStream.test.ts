import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Application } from "express";
import { StatusCodes } from "http-status-codes";

import type { getPrismaClient } from "@repo/db";
import { analysisStatusEventSchema } from "@repo/common";

import analysisStateService from "../../../src/services/analysisStateService";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "../helpers/testSetup";
import { closeQueueConnections, resetAnalysisQueue } from "../helpers/queue";
import { openSse, type SseConnection } from "../helpers/sseClient";
import { registerUser } from "../helpers/requestSender/authRequests";
import { createWorkoutSession } from "../helpers/requestSender/workoutSessionsRequests";
import {
  getAnalysisStatus,
  submitCapture,
} from "../helpers/requestSender/sessionsRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";

import { PoseCaptureBuilder } from "../builders/poseCaptureBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";
import { WorkoutSessionBuilder } from "../builders/workoutSessionBuilder";

describe("GET /api/sessions/:id/status", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;
  let server: Server;
  let baseUrl: string;
  let token: string;
  let exerciseCode: string;
  const connections: SseConnection[] = [];

  const registerToken = async (): Promise<string> => {
    const dto = new RegisterUserBuilder().build();
    const res = await registerUser(app, dto);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: dto.email },
      select: { id: true },
    });
    await grantAiPrerequisites(prisma, user.id);
    return res.body.data.token as string;
  };

  const pendingSession = async (): Promise<number> => {
    const res = await createWorkoutSession(
      app,
      token,
      new WorkoutSessionBuilder().setExerciseCode(exerciseCode).build(),
    );
    return res.body.data.id as number;
  };

  const queuedSession = async () => {
    const sessionId = await pendingSession();
    const accepted = await submitCapture(
      app,
      token,
      sessionId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );
    expect(accepted.status).toBe(StatusCodes.ACCEPTED);
    return { sessionId, jobId: accepted.body.data.jobId as string };
  };

  const connect = async (
    sessionId: number,
    bearer: string | undefined = token,
  ) => {
    const connection = await openSse(
      baseUrl,
      `/api/sessions/${sessionId}/status`,
      bearer,
    );
    connections.push(connection);
    return connection;
  };

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    token = await registerToken();
    exerciseCode = (await createExercise(prisma, { code: "push_up" })).code;
  });

  beforeEach(async () => {
    await resetAnalysisQueue();
  });

  afterEach(() => {
    connections.splice(0).forEach((c) => c.close());
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    });
    await teardownIntegrationTest(prisma);
    await closeQueueConnections();
  });

  it("responds 200 with an event-stream content type", async () => {
    const { sessionId } = await queuedSession();

    const connection = await connect(sessionId);

    expect(connection.statusCode).toBe(StatusCodes.OK);
    expect(connection.headers["content-type"]).toMatch(/^text\/event-stream/);
  });

  it("streams the live transitions in order and closes on COMPLETED", async () => {
    const { sessionId, jobId } = await queuedSession();
    const connection = await connect(sessionId);
    await connection.waitForEvents(1);

    await analysisStateService.advanceStage(
      sessionId,
      jobId,
      "ANALYZING_REPS",
      0,
    );
    await connection.waitForEvents(2);
    await analysisStateService.advanceStage(
      sessionId,
      jobId,
      "WRITING_FEEDBACK",
      0,
    );
    await connection.waitForEvents(3);
    await analysisStateService.completeRun(sessionId, jobId);
    await connection.waitForEvents(4);
    await connection.ended;

    const events = connection.events.map((e) =>
      analysisStatusEventSchema.parse(e.data),
    );
    expect(events.map((e) => e.status)).toEqual([
      "QUEUED",
      "PROCESSING",
      "PROCESSING",
      "COMPLETED",
    ]);
    expect(events.map((e) => e.stage)).toEqual([
      "QUEUED",
      "ANALYZING_REPS",
      "WRITING_FEEDBACK",
      "COMPLETED",
    ]);
    expect(events.at(-1)?.progress_percent).toBe(100);

    const percents = events.map((e) => e.progress_percent);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
  });

  it("gives a reconnecting client the current state first", async () => {
    const { sessionId, jobId } = await queuedSession();
    await analysisStateService.advanceStage(
      sessionId,
      jobId,
      "WRITING_FEEDBACK",
      0,
    );

    const connection = await connect(sessionId);
    const [first] = await connection.waitForEvents(1);

    expect(analysisStatusEventSchema.parse(first.data).stage).toBe(
      "WRITING_FEEDBACK",
    );
  });

  it("sends one COMPLETED event and ends for a completed session", async () => {
    const { sessionId, jobId } = await queuedSession();
    await analysisStateService.completeRun(sessionId, jobId);

    const connection = await connect(sessionId);
    await connection.ended;

    expect(connection.events).toHaveLength(1);
    const event = analysisStatusEventSchema.parse(connection.events[0].data);
    expect(event.status).toBe("COMPLETED");
    expect(event.progress_percent).toBe(100);
  });

  it("sends one FAILED event with the reason and ends for a failed session", async () => {
    const { sessionId, jobId } = await queuedSession();
    await analysisStateService.failRun(sessionId, jobId, "TIMEOUT");

    const connection = await connect(sessionId);
    await connection.ended;

    expect(connection.events).toHaveLength(1);
    const event = analysisStatusEventSchema.parse(connection.events[0].data);
    expect(event.status).toBe("FAILED");
    expect(event.failure_reason).toBe("TIMEOUT");
  });

  it("returns 401 without a token", async () => {
    const { sessionId } = await queuedSession();

    const response = await getAnalysisStatus(app, undefined, sessionId);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("returns 404 for another user's session", async () => {
    const { sessionId } = await queuedSession();

    const response = await getAnalysisStatus(
      app,
      await registerToken(),
      sessionId,
    );

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 409 for a PENDING session", async () => {
    const sessionId = await pendingSession();

    const response = await getAnalysisStatus(app, token, sessionId);

    expect(response.status).toBe(StatusCodes.CONFLICT);
  });
});
