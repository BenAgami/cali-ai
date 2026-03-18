import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import asyncHandler from "../utils/asyncWrapper";
import exerciseService from "../services/exerciseService";

type ListExercisesQuery = {
  limit?: string;
  offset?: string;
  includeInactive?: string;
};

/**
 * List exercises
 * @route GET /api/exercises
 */
export const listExercises = asyncHandler(
  async (
    req: Request<unknown, unknown, unknown, ListExercisesQuery>,
    res: Response,
  ) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const includeInactive =
      req.query.includeInactive === "true" || req.query.includeInactive === "1";

    const result = await exerciseService.listExercises({
      limit,
      offset,
      includeInactive,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Exercises retrieved successfully",
      data: result,
    });
  },
);

type GetExerciseParams = {
  code: string;
};

/**
 * Get exercise by code
 * @route GET /api/exercises/:code
 */
export const getExerciseByCode = asyncHandler(
  async (req: Request<GetExerciseParams>, res: Response) => {
    const { code } = req.params;

    const exercise = await exerciseService.getExerciseByCode(code);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Exercise retrieved successfully",
      data: exercise,
    });
  },
);
