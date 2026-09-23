import { defineConfig } from "vitest/config";
import { config } from "dotenv";

import { unitEnv } from "./tests/unit/helpers/unitEnv";

config({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          env: unitEnv,
          pool: "threads",
          fileParallelism: true,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup.ts"],
          globalSetup: ["tests/globalSetup.ts"],
          pool: "forks",
          fileParallelism: false,
          sequence: { concurrent: false },
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/app.ts",
        "src/openapi/**",
        "src/routes/**",
        "src/types/**",
        "src/lib/logger.ts",
        "src/lib/queue.ts",
        "src/lib/r2.ts",
        "src/lib/redis.ts",
      ],
    },
  },
});
