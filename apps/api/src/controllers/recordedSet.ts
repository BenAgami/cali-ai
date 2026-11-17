import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import type { ProcessingStatus } from "@repo/db";
import type { CreateRecordedSetValues } from "@repo/common";

import requireUserUuid from "../utils/requireUserUuid";
import recordedSetService from "../services/recordedSetService";

type ListRecordedSetsQuery = {
  limit?: number;
  offset?: number;
  exerciseCode?: string;
  processingStatus?: ProcessingStatus;
};

/**
 * Create recorded set
 * @route POST /api/recorded-sets
 */
export const createRecordedSet = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const data = req.body as CreateRecordedSetValues;
  const recordedSet = await recordedSetService.createRecordedSet(
    userUuid,
    data,
  );

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Recorded set created successfully",
    data: recordedSet,
  });
};

/**
 * List recorded sets for current user
 * @route GET /api/recorded-sets
 */
export const listRecordedSets = async (
  req: Request<unknown, unknown, unknown, ListRecordedSetsQuery>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const limit = req.query.limit ?? 20;
  const offset = req.query.offset ?? 0;
  const { exerciseCode, processingStatus } = req.query;

  const result = await recordedSetService.listRecordedSets({
    userUuid,
    limit,
    offset,
    exerciseCode,
    processingStatus,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Recorded sets retrieved successfully",
    data: result,
  });
};
