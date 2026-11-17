import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import type {
  CreateWorkoutPlanValues,
  GenerateWorkoutValues,
  RecordedSetsQuery,
  UpdateWorkoutPlanValues,
} from "@repo/common";

import requireUserUuid from "../utils/requireUserUuid";
import analysisResultQueryService from "../services/analysisResultQueryService";
import workoutPlanService from "../services/workoutPlanService";
import workoutGenerationService from "../services/workoutGenerationService";

type ListWorkoutPlansQuery = {
  limit?: number;
  offset?: number;
};

type WorkoutPlanIdParam = {
  id: string;
};

type WorkoutRunIdParam = WorkoutPlanIdParam & {
  runId: string;
};

/**
 * List workouts for current user
 * @route GET /api/workout-plans
 */
export const listWorkoutPlans = async (
  req: Request<WorkoutPlanIdParam, unknown, unknown, ListWorkoutPlansQuery>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const limit = req.query.limit ?? 20;
  const offset = req.query.offset ?? 0;

  const result = await workoutPlanService.listWorkoutPlans({
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
 * @route GET /api/workout-plans/:id
 */
export const getWorkoutPlanById = async (
  req: Request<WorkoutPlanIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workoutPlanId = Number(req.params.id);
  const workout = await workoutPlanService.getWorkoutPlanById(
    userUuid,
    workoutPlanId,
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Workout retrieved successfully",
    data: workout,
  });
};

/**
 * List the recorded (form-analysed) sets of a workout
 * @route GET /api/workout-plans/:id/recorded-sets
 */
export const listRecordedSets = async (
  req: Request<WorkoutPlanIdParam>,
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
 * @route POST /api/workout-plans
 */
export const createWorkoutPlan = async (
  req: Request<WorkoutPlanIdParam, unknown, CreateWorkoutPlanValues>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workout = await workoutPlanService.createWorkoutPlan(
    userUuid,
    req.body,
  );

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Workout created successfully",
    data: workout,
  });
};

/**
 * Update workout
 * @route PATCH /api/workout-plans/:id
 */
export const updateWorkoutPlan = async (
  req: Request<WorkoutPlanIdParam, unknown, UpdateWorkoutPlanValues>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workoutPlanId = Number(req.params.id);
  const workout = await workoutPlanService.updateWorkoutPlan(
    userUuid,
    workoutPlanId,
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
 * @route DELETE /api/workout-plans/:id
 */
export const deleteWorkoutPlan = async (
  req: Request<WorkoutPlanIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workoutPlanId = Number(req.params.id);
  await workoutPlanService.deleteWorkoutPlan(userUuid, workoutPlanId);

  res.status(StatusCodes.NO_CONTENT).send();
};

/**
 * Start a workout run (create an in-progress run)
 * @route POST /api/workout-plans/:id/runs
 */
export const startWorkout = async (
  req: Request<WorkoutPlanIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const workoutPlanId = Number(req.params.id);
  const run = await workoutPlanService.startWorkoutRun(userUuid, workoutPlanId);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Workout started successfully",
    data: run,
  });
};

/**
 * Complete a workout run
 * @route PATCH /api/workout-plans/:id/runs/:runId
 */
export const completeWorkout = async (
  req: Request<WorkoutRunIdParam>,
  res: Response,
) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const run = await workoutPlanService.completeWorkoutRun(
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
 * @route POST /api/workout-plans/generate
 */
export const generateWorkout = async (
  req: Request<WorkoutPlanIdParam, unknown, GenerateWorkoutValues>,
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
