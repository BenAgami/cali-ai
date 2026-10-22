import { Queue } from "bullmq";

import { env } from "../config/env";
import { redisConnection } from "./redis";

export const FORM_ANALYSIS_QUEUE_NAME = "form-analysis";
export const ANALYSIS_JOB_NAME = "analyze-capture";
export const ANALYSIS_MAINTENANCE_QUEUE_NAME = "analysis-maintenance";
export const REAP_STUCK_JOB_NAME = "reap-stuck-analyses";

export type AnalysisJobData = {
  sessionId: number;
  captureId: number;
};

// D-11: BullMQ-native retries, exponential backoff (2 s, then 4 s).
export const formAnalysisQueue = new Queue<AnalysisJobData>(
  FORM_ANALYSIS_QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: env.analysis.maxAttempts,
      backoff: { type: "exponential", delay: env.analysis.backoffDelayMs },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  },
);

export const maintenanceQueue = new Queue(ANALYSIS_MAINTENANCE_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: { count: 50 },
  },
});
