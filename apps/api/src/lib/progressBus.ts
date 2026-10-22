import type IORedis from "ioredis";
import {
  analysisStatusEventSchema,
  type AnalysisStatusEvent,
} from "@repo/common";

import { createRedisConnection, redisConnection } from "./redis";
import { logger } from "./logger";
import { toError } from "../utils/toError";

type Listener = (event: AnalysisStatusEvent) => void;

const channelFor = (sessionId: number): string =>
  `analysis:session:${sessionId}`;

let subscriber: IORedis | null = null;
const listeners = new Map<string, Set<Listener>>();

const handleMessage = (channel: string, message: string): void => {
  let payload: unknown;
  try {
    payload = JSON.parse(message);
  } catch (error) {
    logger.warn(
      { err: toError(error), channel },
      "Dropped malformed analysis event",
    );
    return;
  }

  const parsed = analysisStatusEventSchema.safeParse(payload);
  if (!parsed.success) {
    logger.warn({ channel }, "Dropped malformed analysis event");
    return;
  }

  listeners.get(channel)?.forEach((listener) => {
    try {
      listener(parsed.data);
    } catch (error) {
      logger.error(
        { err: toError(error), channel },
        "Analysis event listener failed",
      );
    }
  });
};

const getSubscriber = (): IORedis => {
  if (!subscriber) {
    subscriber = createRedisConnection();
    subscriber.on("message", handleMessage);
  }
  return subscriber;
};

export const publishAnalysisEvent = async (
  event: AnalysisStatusEvent,
): Promise<void> => {
  await redisConnection.publish(
    channelFor(event.sessionId),
    JSON.stringify(event),
  );
};

export const subscribeToAnalysisEvents = async (
  sessionId: number,
  listener: Listener,
): Promise<() => Promise<void>> => {
  const channel = channelFor(sessionId);
  const sub = getSubscriber();

  let set = listeners.get(channel);
  const isNewChannel = !set;
  if (!set) {
    set = new Set();
    listeners.set(channel, set);
  }
  set.add(listener);

  if (isNewChannel) await sub.subscribe(channel);

  return async () => {
    const current = listeners.get(channel);
    if (!current) return;

    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(channel);
      await sub.unsubscribe(channel);
    }
  };
};

export const closeProgressBus = async (): Promise<void> => {
  listeners.clear();
  if (!subscriber) return;

  const sub = subscriber;
  subscriber = null;
  await sub.quit();
};
