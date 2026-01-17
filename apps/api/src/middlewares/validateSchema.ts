import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";
import { StatusCodes } from "http-status-codes";

import { getZodErrorMessage } from "../utils/zodErrorMessage";

const validateSchema =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = getZodErrorMessage(error);
        res.status(StatusCodes.BAD_REQUEST).json({
          message: "Validation Error",
          details: errorMessage,
        });
        return;
      }
      next(error);
    }
  };

export default validateSchema;
