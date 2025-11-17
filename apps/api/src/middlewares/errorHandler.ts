import { Request, Response, NextFunction } from "express";

// TODO: Enhanced Error Handling
const errorHandler = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(error);

  const status = error.status || 500;
  const message = error.message || "Internal Server Error";

  res.status(status).json({
    success: false,
    message,
  });
};

export default errorHandler;
