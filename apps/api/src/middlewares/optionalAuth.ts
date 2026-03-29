import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import MyJwtPayload from "../types/myJwtPayload";
import { env } from "../config/env";

const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, env.jwt.secret);
      req.user = decoded as MyJwtPayload;
    } catch {
      // Token invalid or expired — continue without user
    }
  }
  next();
};

export default optionalAuth;
