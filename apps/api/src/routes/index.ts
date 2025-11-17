import { Router } from "express";

import healthRoutes from "./health";

const router: Router = Router();

router.use("/health", healthRoutes);

export default router;
