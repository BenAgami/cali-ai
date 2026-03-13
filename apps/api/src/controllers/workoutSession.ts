import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { CreateWorkoutSessionValues } from "@repo/common";

import asyncHandler from "../utils/asyncWrapper";
import workoutSessionService from "../services/workoutSessionService";

type ListWorkoutSessionsQuery = {
  limit?: string;
  offset?: string;
  exerciseCode?: string;
};

const serializeSession = <T extends { videoSizeBytes?: bigint | null }>(
  session: T,
) => ({
  ...session,
  videoSizeBytes:
    session.videoSizeBytes === null || session.videoSizeBytes === undefined
      ? null
      : Number(session.videoSizeBytes),
});

/**
 * Create workout session
 * @route POST /api/sessions
 */
export const createWorkoutSession = asyncHandler(
  async (req: Request, res: Response) => {
    const userUuid = req.user?.sub;

    if (!userUuid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Unauthorized access - user UUID is missing",
      });
    }

    const data: CreateWorkoutSessionValues = req.body;
    const session = await workoutSessionService.createSession(userUuid, data);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Workout session created successfully",
      data: serializeSession(session),
    });
  },
);

/**
 * List workout sessions for current user
 * @route GET /api/sessions
 */
export const listWorkoutSessions = asyncHandler(
  async (req: Request<unknown, unknown, unknown, ListWorkoutSessionsQuery>, res: Response) => {
    const userUuid = req.user?.sub;

    if (!userUuid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Unauthorized access - user UUID is missing",
      });
    }

    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const exerciseCode = req.query.exerciseCode;

    const result = await workoutSessionService.listSessions({
      userUuid,
      limit,
      offset,
      exerciseCode,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Workout sessions retrieved successfully",
      data: {
        ...result,
        items: result.items.map(serializeSession),
      },
    });
  },
);
