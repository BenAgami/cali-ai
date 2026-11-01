import IORedis from "ioredis";
import { env } from "../config/env";

export const createRedisConnection = (): IORedis =>
  new IORedis(env.redis.url, { maxRetriesPerRequest: null });

export const redisConnection = new IORedis(env.redis.url, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
