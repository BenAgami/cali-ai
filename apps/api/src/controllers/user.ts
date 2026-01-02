import { Request, Response } from "express";
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

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: newUser,
    });
  }
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

  res.status(200).json({
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

    if (!uuid) {
      res.status(400).json({
        success: false,
        message: "Invalid user UUID",
      });
      return;
    }

    const user = await userService.getUserByUuid(uuid);

    res.status(200).json({
      success: true,
      message: "User profile retrieved successfully",
      data: user,
    });
  }
);
