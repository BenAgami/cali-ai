import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class NotFoundError extends ApiError {
  constructor(message: string = "Not Found") {
    super(message, StatusCodes.NOT_FOUND);
  }
}

export default NotFoundError;
