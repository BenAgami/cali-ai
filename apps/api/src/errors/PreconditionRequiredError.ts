import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class PreconditionRequiredError extends ApiError {
  constructor(message: string = "Precondition Required", code?: string) {
    super(message, StatusCodes.PRECONDITION_REQUIRED, code);
  }
}

export default PreconditionRequiredError;
