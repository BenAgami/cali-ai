import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

import { Role } from "@repo/db";

const authorize =
  (...allowedRoles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Authentication required to access this resource",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
    }

    next();
  };

export default authorize;
