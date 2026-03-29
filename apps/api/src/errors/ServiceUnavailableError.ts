import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class ServiceUnavailableError extends ApiError {
  constructor(message: string = "Service Unavailable") {
    super(message, StatusCodes.SERVICE_UNAVAILABLE);
  }
}

export default ServiceUnavailableError;
