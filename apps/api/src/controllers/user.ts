import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { RegisterValues, LoginValues } from "@repo/common";

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

    const newUser = await userService.register({
      name,
      email,
      password,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "User registered successfully",
      data: newUser,
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

  const user = await userService.login({
    email,
    password,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "User logged in successfully",
    data: user,
  });
});

/**
 * Get user profile
 * @route GET /api/users/:uuid
 * @param {Request} req - Express request object with user UUID in params
 * @param {Response} res - Express response object
 * @returns {Object} User data
 */
export const getUserProfile = asyncHandler(
  async (req: Request, res: Response) => {
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
  const uuid = req.user?.uuid;

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
