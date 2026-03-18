import { Router } from "express";

import healthRoutes from "./health";
import userRoutes from "./user";
import sessionRoutes from "./session";
import exerciseRoutes from "./exercise";

const router: Router = Router();

router.use("/health", healthRoutes);
router.use("/users", userRoutes);
router.use("/sessions", sessionRoutes);
router.use("/exercises", exerciseRoutes);

export default router;
