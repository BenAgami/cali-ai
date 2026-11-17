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
import { createRecordedSet } from "../helpers/requestSender/recordedSetsRequests";
import {
  getAnalysisStatus,
  submitCapture,
} from "../helpers/requestSender/recordedSetAnalysisRequests";
import { createExercise } from "../helpers/db/exerciseHelper";
import { grantAiPrerequisites } from "../helpers/db/aiPrerequisitesHelper";

import { PoseCaptureBuilder } from "../builders/poseCaptureBuilder";
import { RegisterUserBuilder } from "../builders/registerUserBuilder";
import { RecordedSetBuilder } from "../builders/recordedSetBuilder";

describe("GET /api/recorded-sets/:id/status", () => {
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

  const pendingRecordedSet = async (): Promise<number> => {
    const res = await createRecordedSet(
      app,
      token,
      new RecordedSetBuilder().setExerciseCode(exerciseCode).build(),
    );
    return res.body.data.id as number;
  };

  const queuedRecordedSet = async () => {
    const recordedSetId = await pendingRecordedSet();
    const accepted = await submitCapture(
      app,
      token,
      recordedSetId,
      new PoseCaptureBuilder().setFrames(30).build(),
    );
    expect(accepted.status).toBe(StatusCodes.ACCEPTED);
    return { recordedSetId, jobId: accepted.body.data.jobId as string };
  };

  const connect = async (
    recordedSetId: number,
    bearer: string | undefined = token,
  ) => {
    const connection = await openSse(
      baseUrl,
      `/api/recorded-sets/${recordedSetId}/status`,
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
    const { recordedSetId } = await queuedRecordedSet();

    const connection = await connect(recordedSetId);

    expect(connection.statusCode).toBe(StatusCodes.OK);
    expect(connection.headers["content-type"]).toMatch(/^text\/event-stream/);
  });

  it("streams the live transitions in order and closes on COMPLETED", async () => {
    const { recordedSetId, jobId } = await queuedRecordedSet();
    const connection = await connect(recordedSetId);
    await connection.waitForEvents(1);

    await analysisStateService.advanceStage(
      recordedSetId,
      jobId,
      "ANALYZING_REPS",
      0,
    );
    await connection.waitForEvents(2);
    await analysisStateService.advanceStage(
      recordedSetId,
      jobId,
      "WRITING_FEEDBACK",
      0,
    );
    await connection.waitForEvents(3);
    await analysisStateService.completeRunWithResult(
      recordedSetId,
      jobId,
      async () => {},
    );
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
    const { recordedSetId, jobId } = await queuedRecordedSet();
    await analysisStateService.advanceStage(
      recordedSetId,
      jobId,
      "WRITING_FEEDBACK",
      0,
    );

    const connection = await connect(recordedSetId);
    const [first] = await connection.waitForEvents(1);

    expect(analysisStatusEventSchema.parse(first.data).stage).toBe(
      "WRITING_FEEDBACK",
    );
  });

  it("sends one COMPLETED event and ends for a completed recorded set", async () => {
    const { recordedSetId, jobId } = await queuedRecordedSet();
    await analysisStateService.completeRunWithResult(
      recordedSetId,
      jobId,
      async () => {},
    );

    const connection = await connect(recordedSetId);
    await connection.ended;

    expect(connection.events).toHaveLength(1);
    const event = analysisStatusEventSchema.parse(connection.events[0].data);
    expect(event.status).toBe("COMPLETED");
    expect(event.progress_percent).toBe(100);
  });

  it("sends one FAILED event with the reason and ends for a failed recorded set", async () => {
    const { recordedSetId, jobId } = await queuedRecordedSet();
    await analysisStateService.failRun(recordedSetId, jobId, "TIMEOUT");

    const connection = await connect(recordedSetId);
    await connection.ended;

    expect(connection.events).toHaveLength(1);
    const event = analysisStatusEventSchema.parse(connection.events[0].data);
    expect(event.status).toBe("FAILED");
    expect(event.failure_reason).toBe("TIMEOUT");
  });

  it("returns 401 without a token", async () => {
    const { recordedSetId } = await queuedRecordedSet();

    const response = await getAnalysisStatus(app, undefined, recordedSetId);

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("returns 404 for another user's recorded set", async () => {
    const { recordedSetId } = await queuedRecordedSet();

    const response = await getAnalysisStatus(
      app,
      await registerToken(),
      recordedSetId,
    );

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("returns 409 for a PENDING recorded set", async () => {
    const recordedSetId = await pendingRecordedSet();

    const response = await getAnalysisStatus(app, token, recordedSetId);

    expect(response.status).toBe(StatusCodes.CONFLICT);
  });
});
