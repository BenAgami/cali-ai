import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class BadRequestError extends ApiError {
  constructor(message: string = "Bad Request") {
    super(message, StatusCodes.BAD_REQUEST);
  }
}

export default BadRequestError;
