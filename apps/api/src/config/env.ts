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
};
