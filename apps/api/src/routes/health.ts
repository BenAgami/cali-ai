import { Request, Response, Router } from "express";
import { StatusCodes } from "http-status-codes";

const router: Router = Router();

// TODO: Enhanced Health Checks (Readiness Checks)
router.get("/", (_: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ status: "ok" });
});

export default router;
