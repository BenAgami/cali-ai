import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import type MyJwtPayload from "../../types/myJwtPayload";
import { env } from "../../config/env";

const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, env.jwt.secret, (err, user) => {
      if (!err) req.user = user as MyJwtPayload;
    });
  }

  next();
};

export default optionalAuth;
