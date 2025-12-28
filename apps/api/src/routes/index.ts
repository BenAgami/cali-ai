import { Router } from "express";

import healthRoutes from "./health";
import userRoutes from "./user";

const router: Router = Router();

router.use("/health", healthRoutes);
router.use("/users", userRoutes);

export default router;
