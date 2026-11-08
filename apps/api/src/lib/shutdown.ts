import type { Server } from "node:http";

import { disconnectPrisma } from "@repo/db";

import { closeProgressBus } from "./progressBus";
import { formAnalysisQueue, maintenanceQueue } from "./queue";
import { redisConnection } from "./redis";
import { logger } from "./logger";
import { toError } from "../utils/toError";
import { stopWorkers } from "../workers";

let isShuttingDown = false;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const shutdown = async (
  getServer: () => Server | undefined,
  signal: string,
  exitCode = 0,
): Promise<void> => {
  if (isShuttingDown) {
    logger.warn(`Received ${signal} during shutdown, ignoring`);
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  try {
    const server = getServer();
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }

    await stopWorkers();
    await closeProgressBus();
    await formAnalysisQueue.close();
    await maintenanceQueue.close();
    await redisConnection.quit();
    await disconnectPrisma();

    process.exit(exitCode);
  } catch (error) {
    logger.error({ err: toError(error) }, "Error during graceful shutdown");
    process.exit(1);
  }
};

export const registerShutdownHandlers = (
  getServer: () => Server | undefined,
): void => {
  process.on("SIGINT", () => {
    void shutdown(getServer, "SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown(getServer, "SIGTERM");
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ err: toError(error) }, "Uncaught exception");
    void shutdown(getServer, "uncaughtException", 1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: toError(reason) }, "Unhandled promise rejection");
    void shutdown(getServer, "unhandledRejection", 1);
  });
};
