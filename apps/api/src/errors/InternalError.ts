import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class InternalError extends ApiError {
  constructor(message: string = "Internal Server Error") {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

export default InternalError;
