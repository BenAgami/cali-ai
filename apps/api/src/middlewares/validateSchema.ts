import { Request, Response, NextFunction } from "express";
import z, { ZodError, ZodType } from "zod";
import { StatusCodes } from "http-status-codes";

const validateSchema = (schema: ZodType) => {
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.issues.map((issue: z.core.$ZodIssue) => ({
          message: `${issue.path.join(".")} - ${issue.message}`,
        }));
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "Validation Error",
          details: errorMessage,
        });
      }
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Internal Server Error",
    });
  };
};

export default validateSchema;
