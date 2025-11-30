import { Request, Response } from "express";

import asyncHandler from "../utils/asyncWrapper";

export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    // Registration logic here
    res.status(201).json({ message: "User registered successfully" });
  }
);

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  // Login logic here
  res.status(200).json({ message: "User logged in successfully" });
});
