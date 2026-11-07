import { StatusCodes } from "http-status-codes";

class ApiError extends Error {
  readonly status: number;
  readonly statusCode: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code?: string,
  ) {
    super(message);
    this.status = this.statusCode = status;
    this.code = code;

    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    Error.captureStackTrace?.(this);
  }
}

export default ApiError;
