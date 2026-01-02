import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

export default UnauthorizedError;
