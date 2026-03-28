import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { getPrismaClient } from "@repo/db";

const router: Router = Router();

router.get("/", async (_req, res) => {
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    res.status(StatusCodes.OK).json({ status: "ok", db: "ok" });
  } catch {
    res
      .status(StatusCodes.SERVICE_UNAVAILABLE)
      .json({ status: "error", db: "unreachable" });
  }
});

export default router;
