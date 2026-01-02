import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class ConflictError extends ApiError {
  constructor(message: string = "Conflict") {
    super(message, StatusCodes.CONFLICT);
  }
}

export default ConflictError;
