import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class ConflictError extends ApiError {
  constructor(message: string = "Conflict", code?: string) {
    super(message, StatusCodes.CONFLICT, code);
  }
}

export default ConflictError;
