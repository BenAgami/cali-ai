import IORedis from "ioredis";
import { env } from "../config/env";

// maxRetriesPerRequest: null is REQUIRED for BullMQ workers
// Without it, workers throw MaxRetriesPerRequestError on Redis reconnect
export const redisConnection = new IORedis(env.redis.url, {
  maxRetriesPerRequest: null,
});
