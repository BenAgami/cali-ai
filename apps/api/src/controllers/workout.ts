import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import type {
  CreateWorkoutValues,
  GenerateWorkoutValues,
  UpdateWorkoutValues,
  CompleteWorkoutLogValues,
} from "@repo/common";

import requireUserUuid from "../utils/requireUserUuid";
import analysisResultQueryService from "../services/analysisResultQueryService";
import workoutService from "../services/workoutService";
import workoutGenerationService from "../services/workoutGenerationService";

type ListWorkoutsQuery = {
  limit?: number;
  offset?: number;
};

type RecordedSetsQuery = {
  workoutLogId?: number;
};

type WorkoutIdParam = {
  id: string;
};

type WorkoutLogIdParam = WorkoutIdParam & {
  logId: string;
};

/**
 * List workouts for current user
 * @route GET /api/workouts
 */
export const listWorkouts = async (
  req: Request<WorkoutIdParam, unknown, unknown, ListWorkoutsQuery>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const limit = req.query.limit ?? 20;
  const offset = req.query.offset ?? 0;

  const result = await workoutService.listWorkouts({
    userUuid,
    limit,
    offset,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Workouts retrieved successfully",
    data: result,
  });
};

/**
 * Get workout by id
 * @route GET /api/workouts/:id
 */
export const getWorkoutById = async (
  req: Request<WorkoutIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workoutId = Number(req.params.id);
  const workout = await workoutService.getWorkoutById(userUuid, workoutId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Workout retrieved successfully",
    data: workout,
  });
};

/**
 * List the recorded (form-analysed) sets of a workout
 * @route GET /api/workouts/:id/recorded-sets
 */
export const listRecordedSets = async (
  req: Request<WorkoutIdParam, unknown, unknown, RecordedSetsQuery>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const data = await analysisResultQueryService.listRecordedSets(
    userUuid,
    Number(req.params.id),
    req.query.workoutLogId,
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Recorded sets retrieved",
    data,
  });
};

/**
 * Create workout
 * @route POST /api/workouts
 */
export const createWorkout = async (
  req: Request<WorkoutIdParam, unknown, CreateWorkoutValues>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workout = await workoutService.createWorkout(userUuid, req.body);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Workout created successfully",
    data: workout,
  });
};

/**
 * Update workout
 * @route PATCH /api/workouts/:id
 */
export const updateWorkout = async (
  req: Request<WorkoutIdParam, unknown, UpdateWorkoutValues>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workoutId = Number(req.params.id);
  const workout = await workoutService.updateWorkout(
    userUuid,
    workoutId,
    req.body,
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Workout updated successfully",
    data: workout,
  });
};

/**
 * Delete workout
 * @route DELETE /api/workouts/:id
 */
export const deleteWorkout = async (
  req: Request<WorkoutIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workoutId = Number(req.params.id);
  await workoutService.deleteWorkout(userUuid, workoutId);

  res.status(StatusCodes.NO_CONTENT).send();
};

/**
 * Start a workout run (create an in-progress log)
 * @route POST /api/workouts/:id/logs
 */
export const startWorkout = async (
  req: Request<WorkoutIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workoutId = Number(req.params.id);
  const log = await workoutService.startWorkoutLog(userUuid, workoutId);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Workout started successfully",
    data: log,
  });
};

/**
 * Complete a workout run
 * @route PATCH /api/workouts/:id/logs/:logId
 */
export const completeWorkout = async (
  req: Request<WorkoutLogIdParam, unknown, CompleteWorkoutLogValues>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const log = await workoutService.completeWorkoutLog(
    userUuid,
    Number(req.params.id),
    Number(req.params.logId),
    req.body,
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Workout completed successfully",
    data: log,
  });
};

/**
 * Generate an AI workout preview
 * @route POST /api/workouts/generate
 */
export const generateWorkout = async (
  req: Request<WorkoutIdParam, unknown, GenerateWorkoutValues>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const preview = await workoutGenerationService.generate(userUuid, req.body);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Workout generated",
    data: preview,
  });
};
