import { Request, Response, NextFunction } from "express";
import jwt, { JsonWebTokenError } from "jsonwebtoken";

import UnauthorizedError from "../errors/UnauthorizedError";
import ForbiddenError from "../errors/ForbiddenError";

import MyJwtPayload from "../types/myJwtPayload";
import { env } from "../config/env";

const authenticateToken = (req: Request, _: Response, next: NextFunction) => {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new UnauthorizedError("Authorization header missing or malformed"),
    );
  }
  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, env.jwt.secret, (err, user) => {
      if (err instanceof JsonWebTokenError) {
        return next(new ForbiddenError("Invalid token:" + err.message));
      }
      req.user = user as MyJwtPayload;
      next();
    });
  } catch (error) {
    return next(new ForbiddenError("Invalid token"));
  }
};

export default authenticateToken;
