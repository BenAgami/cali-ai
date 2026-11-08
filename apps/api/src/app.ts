import "./openapi/extend";

import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { StatusCodes } from "http-status-codes";

import routes from "./routes";
import errorHandler from "./middlewares/errorHandler";
import { env } from "./config/env";
import { logger } from "./lib/logger";

export const createApp = (): Application => {
  const app: Application = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsAllowedOrigins.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.use(pinoHttp({ logger, autoLogging: env.runtimeEnv !== "test" }));

  app.use("/api", routes);

  app.use((req: Request, res: Response) => {
    res.status(StatusCodes.NOT_FOUND).json({
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  app.use(errorHandler);

  return app;
};
