import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export type VideoAnalysisJobData = {
  sessionId: number;
  r2Key: string;
};

export const VIDEO_ANALYSIS_WORKER_CONCURRENCY = 5;

export const videoAnalysisQueue = new Queue<VideoAnalysisJobData>(
  "video-analysis",
  { connection: redisConnection },
);
