import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class TooManyRequestsError extends ApiError {
  constructor(message: string = "Too Many Requests", code?: string) {
    super(message, StatusCodes.TOO_MANY_REQUESTS, code);
  }
}

export default TooManyRequestsError;
