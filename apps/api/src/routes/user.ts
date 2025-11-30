import { Router } from "express";
import z from "zod";

import { loginSchema, registerSchema } from "@repo/common";

import validateSchema from "../middlewares/validateSchema";
import { registerUser, loginUser } from "../controllers/user";

const router: Router = Router();

router.post(
  "/register",
  validateSchema(z.object({ body: registerSchema })),
  registerUser
);
router.post(
  "/login",
  validateSchema(z.object({ body: loginSchema })),
  loginUser
);

export default router;
