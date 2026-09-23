import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import {
  RegisterValues,
  LoginValues,
  RefreshTokenValues,
  LogoutValues,
} from "@repo/common";

import authService from "../services/authService";
import refreshTokenService from "../services/refreshTokenService";

/**
 * Register a new user
 * @route POST /api/auth/register
 */
export const registerUser = async (req: Request, res: Response) => {
  const { name, email, password } = req.body as RegisterValues;

  const { user, token, refreshToken } = await authService.register({
    name,
    email,
    password,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "User registered successfully",
    data: { user, token, refreshToken },
  });
};

/**
 * Login user
 * @route POST /api/auth/login
 */
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginValues;

  const { user, token, refreshToken } = await authService.login({
    email,
    password,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "User logged in successfully",
    data: { user, token, refreshToken },
  });
};

/**
 * Refresh access token using a valid refresh token
 * @route POST /api/auth/refresh
 */
export const refreshUserToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body as RefreshTokenValues;

  const { token, refreshToken: newRefreshToken } =
    await authService.refresh(refreshToken);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Token refreshed successfully",
    data: { token, refreshToken: newRefreshToken },
  });
};

/**
 * Logout by revoking the refresh token
 * @route POST /api/auth/logout
 */
export const logoutUser = async (req: Request, res: Response) => {
  const { refreshToken } = req.body as LogoutValues;

  await refreshTokenService.revokeToken(refreshToken);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Logged out successfully",
  });
};
