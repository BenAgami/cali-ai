import { defineConfig } from "vitest/config";
import { config } from "dotenv";

const nodeEnv = process.env.NODE_ENV || "test";
config({ path: `.env.${nodeEnv}` });

const unitEnv = {
  NODE_ENV: "test",
  PORT: "3000",
  SERVICE_NAME: "api",
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://unit:unit@127.0.0.1:1/unit?schema=public",
  JWT_SECRET: "unit-test-jwt-secret-not-a-real-secret-000000",
  JWT_EXPIRES_IN: "15m",
  REFRESH_TOKEN_EXPIRES_IN: "7d",
  REDIS_URL: "redis://127.0.0.1:1",
  CORS_ALLOWED_ORIGINS: "http://localhost:8081",
  R2_ACCOUNT_ID: "unit-account-id",
  R2_ACCESS_KEY_ID: "unit-access-key-id",
  R2_SECRET_ACCESS_KEY: "unit-secret-access-key",
  R2_BUCKET_NAME: "unit-bucket",
  R2_PUBLIC_DOMAIN: "https://unit.example.com",
};

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
