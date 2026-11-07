import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class ServiceUnavailableError extends ApiError {
  constructor(message: string = "Service Unavailable", code?: string) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE, code);
  }
}

export default ServiceUnavailableError;
