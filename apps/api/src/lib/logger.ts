import pino from "pino";

import { env } from "../config/env";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "password",
  "*.password",
  "token",
  "*.token",
  "refreshToken",
  "*.refreshToken",
  "apiKey",
  "*.apiKey",
];

export const logger = pino({
  level: env.logLevel ?? (env.runtimeEnv === "production" ? "info" : "debug"),
  base: { service: env.serviceName, env: env.runtimeEnv },
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  transport:
    env.runtimeEnv === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export type Logger = typeof logger;
