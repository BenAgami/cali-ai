import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export type VideoAnalysisJobData = {
  sessionId: number;
  r2Key: string;
};

export const videoAnalysisQueue = new Queue<VideoAnalysisJobData>(
  "video-analysis",
  { connection: redisConnection },
);
