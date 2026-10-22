import { Queue } from "bullmq";

import { redisConnection } from "./redis";

export const FORM_ANALYSIS_QUEUE_NAME = "form-analysis";
export const ANALYSIS_JOB_NAME = "analyze-capture";

export type AnalysisJobData = {
  sessionId: number;
  captureId: number;
};

export const formAnalysisQueue = new Queue<AnalysisJobData>(
  FORM_ANALYSIS_QUEUE_NAME,
  { connection: redisConnection },
);
