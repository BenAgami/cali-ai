import { StatusCodes } from "http-status-codes";

class ApiError extends Error {
  readonly status: number;
  readonly statusCode: number;

  constructor(
    message: string,
    status: number = StatusCodes.INTERNAL_SERVER_ERROR
  ) {
    super(message);
    this.status = this.statusCode = status;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this);
  }
}

export default ApiError;
