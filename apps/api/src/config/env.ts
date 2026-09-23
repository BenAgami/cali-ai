import "dotenv/config";
import { z } from "zod";
import ms, { type StringValue } from "ms";

import { getZodErrorMessage } from "../utils/zodErrorMessage";

const durationString = () =>
  z.custom<StringValue>(
    (val) => typeof val === "string" && ms(val as StringValue) !== undefined,
    { message: "Must be a valid duration string (e.g. '15m', '7d')" },
  );

export const envSchema = z.object({
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
  r2: {
    accountId: parsedData.R2_ACCOUNT_ID,
    accessKeyId: parsedData.R2_ACCESS_KEY_ID,
    secretAccessKey: parsedData.R2_SECRET_ACCESS_KEY,
    bucketName: parsedData.R2_BUCKET_NAME,
    publicDomain: parsedData.R2_PUBLIC_DOMAIN,
  },
};
