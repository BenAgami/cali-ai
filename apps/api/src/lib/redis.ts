import IORedis from "ioredis";
import { env } from "../config/env";

// maxRetriesPerRequest: null is REQUIRED for BullMQ workers
// Without it, workers throw MaxRetriesPerRequestError on reconnect
export const createRedisConnection = (): IORedis =>
  new IORedis(env.redis.url, { maxRetriesPerRequest: null });

// Shared connection for normal commands (publish, BullMQ queue). Subscribers
// and workers must create their own via createRedisConnection(): a connection
// in subscriber mode cannot run regular commands.
export const redisConnection = createRedisConnection();
