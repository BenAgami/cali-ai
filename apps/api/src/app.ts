import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { StatusCodes } from "http-status-codes";

import routes from "./routes";
import errorHandler from "./middlewares/errorHandler";
import { env } from "./config/env";

export const createApp = (): Application => {
  const app: Application = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsAllowedOrigins.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (env.runtimeEnv !== "production") {
    app.use(morgan("dev"));
  }

  app.use("/api", routes);

  app.use((req: Request, res: Response) => {
    res.status(StatusCodes.NOT_FOUND).json({
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  app.use(errorHandler);

  return app;
};
