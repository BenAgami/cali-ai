import IORedis from "ioredis";
import { env } from "../config/env";

// maxRetriesPerRequest: null is REQUIRED for BullMQ workers
// Without it, workers throw MaxRetriesPerRequestError on reconnect
export const createRedisConnection = (): IORedis =>
  new IORedis(env.redis.url, { maxRetriesPerRequest: null });

export const redisConnection = createRedisConnection();
