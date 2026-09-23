import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { UpdateProfileValues, UpsertGoalValues } from "@repo/common";

import requireUserUuid from "../utils/requireUserUuid";
import userService from "../services/userService";

type GetUserProfileParams = {
  uuid: string;
};

/**
 * Get user profile
 * @route GET /api/users/:uuid
 */
export const getUserProfile = async (
  req: Request<GetUserProfileParams>,
  res: Response,
) => {
  const { uuid } = req.params;

  const user = await userService.getUserByUuid(uuid);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "User profile retrieved successfully",
    data: user,
  });
};

/**
 * Get current authenticated user's profile
 * @route GET /api/users/me
 */
export const getMyUser = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const user = await userService.getUserByUuid(userUuid);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "My user profile retrieved successfully",
    data: user,
  });
};

/**
 * Update the current authenticated user's profile
 * @route PATCH /api/users/me
 */
export const updateMyProfile = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const data = req.body as UpdateProfileValues;
  const user = await userService.updateProfile(userUuid, data);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Profile updated successfully",
    data: user,
  });
};

/**
 * Get presigned URL for avatar upload
 * @route POST /api/users/me/avatar-upload-url
 */
export const getAvatarUploadUrl = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const result = await userService.getAvatarUploadUrl(userUuid);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Avatar upload URL generated",
    data: result,
  });
};

/**
 * Create a goal for the current authenticated user
 * @route POST /api/users/me/goals
 */
export const createMyGoal = async (req: Request, res: Response) => {
  const userUuid = requireUserUuid(req, res);
  if (!userUuid) return;

  const data = req.body as UpsertGoalValues;
  const goal = await userService.createGoal(userUuid, data);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Goal created successfully",
    data: goal,
  });
};
