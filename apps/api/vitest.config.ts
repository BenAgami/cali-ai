import { defineConfig } from "vitest/config";
import { config } from "dotenv";

const nodeEnv = process.env.NODE_ENV || "test";
config({ path: `.env.${nodeEnv}` });

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    clearMocks: true,
    restoreMocks: true,
    fileParallelism: false,
    sequence: { concurrent: false },
    pool: "forks",
  },
});
