import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { UnauthorizedError, ForbiddenError } from "../../errors";

import MyJwtPayload from "../../types/myJwtPayload";
import { env } from "../../config/env";

const authenticateToken = (req: Request, _: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(
      new UnauthorizedError("Authorization header missing or malformed"),
    );
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, env.jwt.secret, (err, user) => {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError("Token expired: " + err.message));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new ForbiddenError("Invalid token: " + err.message));
    }
    req.user = user as MyJwtPayload;
    next();
  });
};

export default authenticateToken;
