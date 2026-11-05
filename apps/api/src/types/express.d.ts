import "express";
import type MyJwtPayload from "./myJwtPayload";

declare global {
  namespace Express {
    interface Request {
      user?: MyJwtPayload;
    }
  }
}
