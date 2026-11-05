import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

import { env } from "../config/env";
import { logger } from "../lib/logger";

const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const status =
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : StatusCodes.INTERNAL_SERVER_ERROR;

  const logContext = { err: error, method: req.method, url: req.originalUrl };
  if (status >= Number(StatusCodes.INTERNAL_SERVER_ERROR)) {
    logger.error(logContext, "Unhandled server error");
  } else if (env.runtimeEnv !== "production") {
    logger.debug(logContext, "Request error");
  }

  const message =
    status < Number(StatusCodes.INTERNAL_SERVER_ERROR) && error instanceof Error
      ? error.message
      : "Internal Server Error";

  const code =
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "INTERNAL_ERROR";

  res.status(status).json({
    success: false,
    message,
    code,
    ...(env.runtimeEnv !== "production" && error instanceof Error
      ? { details: error.stack }
      : {}),
  });
};

export default errorHandler;
