import "dotenv/config";
import { connectPrisma } from "@repo/db";
import { createApp } from "./app";

const initializeExpress = (): void => {
  const PORT = process.env.PORT || 3000;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
  });
};

const startServer = async (): Promise<void> => {
  try {
    await connectPrisma(process.env.DATABASE_URL!);
    initializeExpress();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
