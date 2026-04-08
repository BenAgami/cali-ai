import { Request, Response, NextFunction } from "express";

import { env } from "../config/env";

const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (env.runtimeEnv !== "production") {
    console.error(error);
  }

  const status =
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;

  const message =
    status < 500 && error instanceof Error
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
