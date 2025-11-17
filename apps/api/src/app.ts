import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import { StatusCodes } from "http-status-codes";

import routes from "./routes";
import errorHandler from "./middlewares/errorHandler";

export const createApp = (): Application => {
  const app: Application = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression());
  app.use(morgan("dev"));

  app.use("/api", routes);

  app.use("*", (_: Request, res: Response) => {
    res.status(StatusCodes.NOT_FOUND).json({
      message: "Route not found",
    });
  });

  app.use(errorHandler);

  return app;
};
