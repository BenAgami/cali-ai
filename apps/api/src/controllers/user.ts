import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { RegisterValues, LoginValues, UpdateProfileValues, UpsertGoalValues } from "@repo/common";

import asyncHandler from "../utils/asyncWrapper";
import userService from "../services/userService";

/**
 * Register a new user
 * @route POST /api/users/register
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Object} User data and success message
 */
export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, email, password }: RegisterValues = req.body;

    const { user, token } = await userService.register({
      name,
      email,
      password,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "User registered successfully",
      data: { user, token },
    });
  },
);

/**
 * Login user
 * @route POST /api/users/login
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Object} User data and success message
 */
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password }: LoginValues = req.body;

  const { user, token } = await userService.login({
    email,
    password,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "User logged in successfully",
    data: { user, token },
  });
});

/**
 * Get user profile
 * @route GET /api/users/:uuid
 * @param {Request} req - Express request object with user UUID in params
 * @param {Response} res - Express response object
 * @returns {Object} User data
 */
type GetUserProfileParams = {
  uuid: string;
};

export const getUserProfile = asyncHandler(
  async (req: Request<GetUserProfileParams>, res: Response) => {
    const { uuid } = req.params;

    const user = await userService.getUserByUuid(uuid);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "User profile retrieved successfully",
      data: user,
    });
  },
);

/**
 * Get current authenticated user's profile
 * @route GET /api/users/me
 * @param {Request} req - Express request object with authenticated user info
 * @param {Response} res - Express response object
 * @returns {Object} User data
 */
export const getMyUser = asyncHandler(async (req: Request, res: Response) => {
  const uuid = req.user?.sub;

  if (!uuid) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Unauthorized access - user UUID is missing",
    });
  }

  const user = await userService.getUserByUuid(uuid);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "My user profile retrieved successfully",
    data: user,
  });
});

/**
 * Update the current authenticated user's profile
 * @route PATCH /api/users/me
 * @param {Request} req - Express request object with profile update data in body
 * @param {Response} res - Express response object
 * @returns {Object} Updated user data
 */
export const updateMyProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const uuid = req.user?.sub;

    if (!uuid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Unauthorized access - user UUID is missing",
      });
    }

    const data: UpdateProfileValues = req.body;
    const user = await userService.updateProfile(uuid, data);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  },
);

/**
 * Get presigned URL for avatar upload
 * @route POST /api/users/me/avatar-upload-url
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {Object} Upload URL, key, and public URL
 */
export const getAvatarUploadUrl = asyncHandler(
  async (req: Request, res: Response) => {
    const uuid = req.user?.sub;

    if (!uuid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Unauthorized access - user UUID is missing",
      });
    }

    const result = await userService.getAvatarUploadUrl(uuid);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Avatar upload URL generated",
      data: result,
    });
  },
);

/**
 * Create a goal for the current authenticated user
 * @route POST /api/users/me/goals
 * @param {Request} req - Express request object with goal data in body
 * @param {Response} res - Express response object
 * @returns {Object} Created goal data
 */
export const createMyGoal = asyncHandler(
  async (req: Request, res: Response) => {
    const uuid = req.user?.sub;

    if (!uuid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Unauthorized access - user UUID is missing",
      });
    }

    const data: UpsertGoalValues = req.body;
    const goal = await userService.createGoal(uuid, data);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Goal created successfully",
      data: goal,
    });
  },
);
