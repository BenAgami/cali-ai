import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";
import { StatusCodes } from "http-status-codes";

import { getZodErrorMessage } from "../utils/zodErrorMessage";

type ParsedRequest = {
  body?: unknown;
  query?: unknown;
  params?: unknown;
};

const validateSchema =
  (schema: ZodType) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body as unknown,
        query: req.query,
        params: req.params,
      })) as ParsedRequest;

      if ("body" in parsed) {
        req.body = parsed.body;
      }
      if ("params" in parsed) {
        req.params = parsed.params as Request["params"];
      }
      if ("query" in parsed) {
        Object.defineProperty(req, "query", {
          value: parsed.query,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = getZodErrorMessage(error);
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Validation Error",
          details: errorMessage,
        });
        return;
      }
      next(error);
    }
  };

export default validateSchema;
