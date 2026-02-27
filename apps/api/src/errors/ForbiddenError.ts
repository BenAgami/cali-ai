import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden") {
    super(message, StatusCodes.FORBIDDEN);
  }
}

export default ForbiddenError;
