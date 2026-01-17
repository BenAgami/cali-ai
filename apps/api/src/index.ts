import { env } from "./config/env";
import { createApp } from "./app";

const initializeExpress = (): void => {
  const PORT = env.port;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
  });
};

const startServer = async (): Promise<void> => {
  try {
    initializeExpress();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
