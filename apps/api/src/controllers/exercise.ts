import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { Role } from "@repo/db";

import exerciseService from "../services/exerciseService";
import ForbiddenError from "../errors/ForbiddenError";

type ListExercisesQuery = {
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
};

/**
 * List exercises
 * @route GET /api/exercises
 */
export const listExercises = async (
  req: Request<unknown, unknown, unknown, ListExercisesQuery>,
  res: Response,
) => {
  const limit = req.query.limit ?? 20;
  const offset = req.query.offset ?? 0;
  const shouldIncludeInactive = req.query.includeInactive ?? false;

  if (shouldIncludeInactive && req.user?.role !== Role.ADMIN) {
    throw new ForbiddenError(
      "Admin access required to view inactive exercises",
    );
  }

  const result = await exerciseService.listExercises({
    limit,
    offset,
    includeInactive: shouldIncludeInactive,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Exercises retrieved successfully",
    data: result,
  });
};

type GetExerciseParams = {
  code: string;
};

/**
 * Get exercise by code
 * @route GET /api/exercises/:code
 */
export const getExerciseByCode = async (
  req: Request<GetExerciseParams>,
  res: Response,
) => {
  const { code } = req.params;

  const exercise = await exerciseService.getExerciseByCode(code, !!req.user);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Exercise retrieved successfully",
    data: exercise,
  });
};
