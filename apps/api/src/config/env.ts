import "dotenv/config";
import { z } from "zod";
import type { StringValue } from "ms";

import { getZodErrorMessage } from "../utils/zodErrorMessage";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:8081"),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
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
  databaseUrl: parsedData.DATABASE_URL,
  jwt: {
    secret: parsedData.JWT_SECRET,
    expiresIn: parsedData.JWT_EXPIRES_IN as StringValue,
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
  },
};
