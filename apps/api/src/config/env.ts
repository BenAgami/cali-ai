import "dotenv/config";
import { z } from "zod";
import ms, { type StringValue } from "ms";

import { getZodErrorMessage } from "../utils/zodErrorMessage";

const durationString = () =>
  z.custom<StringValue>(
    (val) => typeof val === "string" && ms(val as StringValue) !== undefined,
    { message: "Must be a valid duration string (e.g. '15m', '7d')" },
  );

const ANALYSIS_COMPUTE_MARGIN_MS = 15_000;
// D-13 / ROADMAP criterion 4: a stuck run must be failed within 3 minutes.
const ANALYSIS_MAX_PROCESSING_MS = 180_000;

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(3000),
    SERVICE_NAME: z.enum(["api", "worker"]).default("api"),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .optional(),
    DATABASE_URL: z.url(),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: durationString().default("15m" as StringValue),
    REFRESH_TOKEN_EXPIRES_IN: durationString().default("7d" as StringValue),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:8081"),
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
    R2_PUBLIC_DOMAIN: z
      .string()
      .min(1)
      .transform((v) => v.replace(/^https?:\/\//, "")),
    ANALYSIS_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
    ANALYSIS_BACKOFF_DELAY_MS: z.coerce.number().int().min(0).default(2000),
    ANALYSIS_LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(40000),
    ANALYSIS_STUCK_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(10000)
      .default(150000),
    ANALYSIS_REAPER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .default(15000),
  })
  .superRefine((v, ctx) => {
    const budget =
      v.ANALYSIS_MAX_ATTEMPTS * v.ANALYSIS_LLM_TIMEOUT_MS +
      v.ANALYSIS_BACKOFF_DELAY_MS * (2 ** (v.ANALYSIS_MAX_ATTEMPTS - 1) - 1) +
      ANALYSIS_COMPUTE_MARGIN_MS;

    if (v.ANALYSIS_STUCK_TIMEOUT_MS <= budget) {
      ctx.addIssue({
        code: "custom",
        path: ["ANALYSIS_STUCK_TIMEOUT_MS"],
        message: `ANALYSIS_STUCK_TIMEOUT_MS must exceed the worst-case retry budget of ${budget} ms`,
      });
    }

    if (
      v.ANALYSIS_STUCK_TIMEOUT_MS + v.ANALYSIS_REAPER_INTERVAL_MS >
      ANALYSIS_MAX_PROCESSING_MS
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["ANALYSIS_REAPER_INTERVAL_MS"],
        message: `ANALYSIS_STUCK_TIMEOUT_MS + ANALYSIS_REAPER_INTERVAL_MS must not exceed ${ANALYSIS_MAX_PROCESSING_MS} ms`,
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(getZodErrorMessage(parsed.error));
  throw new Error("Invalid environment variables");
}

const parsedData = parsed.data;

export const env = {
  runtimeEnv: parsedData.NODE_ENV,
  port: parsedData.PORT,
  serviceName: parsedData.SERVICE_NAME,
  logLevel: parsedData.LOG_LEVEL,
  databaseUrl: parsedData.DATABASE_URL,
  jwt: {
    secret: parsedData.JWT_SECRET,
    expiresIn: parsedData.JWT_EXPIRES_IN,
    refreshExpiresIn: parsedData.REFRESH_TOKEN_EXPIRES_IN,
  },
  corsAllowedOrigins: parsedData.CORS_ALLOWED_ORIGINS,
  redis: {
    url: parsedData.REDIS_URL,
  },
  analysis: {
    maxAttempts: parsedData.ANALYSIS_MAX_ATTEMPTS,
    backoffDelayMs: parsedData.ANALYSIS_BACKOFF_DELAY_MS,
    llmTimeoutMs: parsedData.ANALYSIS_LLM_TIMEOUT_MS,
    stuckTimeoutMs: parsedData.ANALYSIS_STUCK_TIMEOUT_MS,
    reaperIntervalMs: parsedData.ANALYSIS_REAPER_INTERVAL_MS,
  },
  r2: {
    accountId: parsedData.R2_ACCOUNT_ID,
    accessKeyId: parsedData.R2_ACCESS_KEY_ID,
    secretAccessKey: parsedData.R2_SECRET_ACCESS_KEY,
    bucketName: parsedData.R2_BUCKET_NAME,
    publicDomain: parsedData.R2_PUBLIC_DOMAIN,
  },
};
