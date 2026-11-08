import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

const requireUserUuid = <P, ResBody, ReqBody, ReqQuery>(
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response,
): string | null => {
  const userUuid = req.user?.sub;
  if (!userUuid) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Unauthorized access - user UUID is missing",
    });
    return null;
  }
  return userUuid;
};

export default requireUserUuid;
