import { Worker } from "bullmq";
import type IORedis from "ioredis";

import { env } from "../config/env";
import { logger } from "../lib/logger";
import {
  ANALYSIS_MAINTENANCE_QUEUE_NAME,
  FORM_ANALYSIS_QUEUE_NAME,
  REAP_STUCK_JOB_NAME,
  maintenanceQueue,
  type AnalysisJobData,
} from "../lib/queue";
import { createRedisConnection } from "../lib/redis";
import { toError } from "../utils/toError";
import { onAnalysisJobFailed, processAnalysisJob } from "./analysisProcessor";
import { processReapJob } from "./reaperProcessor";

const ANALYSIS_WORKER_CONCURRENCY = 5;
const REAPER_SCHEDULER_ID = "reap-stuck-analyses";

type RunningWorker = { worker: Worker; connection: IORedis };
let running: RunningWorker[] = [];

export const startWorkers = async (): Promise<void> => {
  if (running.length > 0) return;

  const analysisConnection = createRedisConnection();
  const analysisWorker = new Worker<AnalysisJobData>(
    FORM_ANALYSIS_QUEUE_NAME,
    processAnalysisJob,
    {
      connection: analysisConnection,
      concurrency: ANALYSIS_WORKER_CONCURRENCY,
    },
  );
  analysisWorker.on("failed", (job, error) => {
    onAnalysisJobFailed(job, error).catch((handlerError: unknown) =>
      logger.error(
        { err: toError(handlerError) },
        "Failed to record analysis job failure",
      ),
    );
  });
  analysisWorker.on("error", (error) =>
    logger.error({ err: error }, "Analysis worker error"),
  );

  const maintenanceConnection = createRedisConnection();
  const maintenanceWorker = new Worker(
    ANALYSIS_MAINTENANCE_QUEUE_NAME,
    processReapJob,
    { connection: maintenanceConnection, concurrency: 1 },
  );
  maintenanceWorker.on("error", (error) =>
    logger.error({ err: error }, "Maintenance worker error"),
  );

  running = [
    { worker: analysisWorker as Worker, connection: analysisConnection },
    { worker: maintenanceWorker, connection: maintenanceConnection },
  ];

  await maintenanceQueue.upsertJobScheduler(
    REAPER_SCHEDULER_ID,
    { every: env.analysis.reaperIntervalMs },
    { name: REAP_STUCK_JOB_NAME },
  );

  logger.info(
    { concurrency: ANALYSIS_WORKER_CONCURRENCY },
    "Analysis workers started",
  );
};

export const stopWorkers = async (): Promise<void> => {
  const stopping = running;
  running = [];
  for (const { worker, connection } of stopping) {
    await worker.close();
    await connection.quit();
  }
};
