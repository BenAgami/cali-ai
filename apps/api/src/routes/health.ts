import { Router } from "express";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient } from "@repo/db";

import ServiceUnavailableError from "../errors/ServiceUnavailableError";

const router: Router = Router();

router.get("/", async (_req, res) => {
  await getPrismaClient().$queryRaw`SELECT 1`.catch(() => {
    throw new ServiceUnavailableError("Database unreachable");
  });

  res.status(StatusCodes.OK).json({ status: "ok", db: "ok" });
});

export default router;
