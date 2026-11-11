import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import type { SessionStatus } from "@repo/db";
import type { CreateWorkoutSessionValues } from "@repo/common";

import requireUserUuid from "../utils/requireUserUuid";
import workoutSessionService from "../services/workoutSessionService";

type ListWorkoutSessionsQuery = {
  limit?: number;
  offset?: number;
  exerciseCode?: string;
  processingStatus?: SessionStatus;
};

/**
 * Create workout session
 * @route POST /api/sessions
 */
export const createWorkoutSession = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const data = req.body as CreateWorkoutSessionValues;
  const session = await workoutSessionService.createSession(userUuid, data);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Workout session created successfully",
    data: session,
  });
};

/**
 * List workout sessions for current user
 * @route GET /api/sessions
 */
export const listWorkoutSessions = async (
  req: Request<unknown, unknown, unknown, ListWorkoutSessionsQuery>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const limit = req.query.limit ?? 20;
  const offset = req.query.offset ?? 0;
  const { exerciseCode, processingStatus } = req.query;

  const result = await workoutSessionService.listSessions({
    userUuid,
    limit,
    offset,
    exerciseCode,
    processingStatus,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Workout sessions retrieved successfully",
    data: result,
  });
};
