import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import type {
  CreateWorkoutValues,
  GenerateWorkoutValues,
  RecordedSetsQuery,
  UpdateWorkoutValues,
} from "@repo/common";

import requireUserUuid from "../utils/requireUserUuid";
import analysisResultQueryService from "../services/analysisResultQueryService";
import workoutService from "../services/workoutService";
import workoutGenerationService from "../services/workoutGenerationService";

type ListWorkoutsQuery = {
  limit?: number;
  offset?: number;
};

type WorkoutIdParam = {
  id: string;
};

type WorkoutRunIdParam = WorkoutIdParam & {
  runId: string;
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
  req: Request<WorkoutIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  // validateSchema replaced req.query with the parsed value, defaults included.
  const query = req.query as unknown as RecordedSetsQuery;
  const data = await analysisResultQueryService.listRecordedSets(
    userUuid,
    Number(req.params.id),
    query,
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
 * Start a workout run (create an in-progress run)
 * @route POST /api/workouts/:id/runs
 */
export const startWorkout = async (
  req: Request<WorkoutIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workoutId = Number(req.params.id);
  const run = await workoutService.startWorkoutRun(userUuid, workoutId);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Workout started successfully",
    data: run,
  });
};

/**
 * Complete a workout run
 * @route PATCH /api/workouts/:id/runs/:runId
 */
export const completeWorkout = async (
  req: Request<WorkoutRunIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const run = await workoutService.completeWorkoutRun(
    userUuid,
    Number(req.params.id),
    Number(req.params.runId),
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Workout completed successfully",
    data: run,
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
