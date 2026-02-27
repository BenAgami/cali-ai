import "express";
import MyJwtPayload from "./myJwtPayload";

declare global {
  namespace Express {
    interface Request {
      user?: MyJwtPayload;
    }
  }
}
