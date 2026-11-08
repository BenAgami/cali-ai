import { StatusCodes } from "http-status-codes";

import ApiError from "./ApiError";

class PayloadTooLargeError extends ApiError {
  constructor(message: string = "Payload Too Large") {
    super(message, StatusCodes.REQUEST_TOO_LONG);
  }
}

export default PayloadTooLargeError;
