import { connectPrisma, disconnectPrisma } from "@repo/db";

import { env } from "./config/env";
import { createApp } from "./app";

const initializeExpress = (): void => {
  const PORT = env.port;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
  });
};

const shutdown = async () => {
  await disconnectPrisma();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const startServer = async (): Promise<void> => {
  try {
    await connectPrisma(env.databaseUrl, env.runtimeEnv === "production");
    initializeExpress();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
