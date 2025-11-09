import { z, ZodEmail, ZodString } from "zod";

import { AUTH_MESSAGES } from "../constants/messages";

const fullNameSchema: ZodString = z
  .string()
  .trim()
  .min(1, AUTH_MESSAGES.nameRequired)
  .regex(/^[a-zA-Z\s-]+$/, AUTH_MESSAGES.nameInvalid)
  .refine(
    (val) => val.trim().split(/\s+/).length >= 2,
    AUTH_MESSAGES.nameTooShort
  );

const emailSchema: ZodEmail = z.email(AUTH_MESSAGES.emailInvalid);

const strongPasswordSchema: ZodString = z
  .string()
  .min(8, AUTH_MESSAGES.passwordTooShort(8))
  .regex(/[A-Z]/, AUTH_MESSAGES.passwordUppercase)
  .regex(/[a-z]/, AUTH_MESSAGES.passwordLowercase)
  .regex(/[0-9]/, AUTH_MESSAGES.passwordNumber)
  .regex(/[^A-Za-z0-9]/, AUTH_MESSAGES.passwordSpecialChar);

export const loginSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
});

export const registerSchema = z.object({
  name: fullNameSchema,
  email: emailSchema,
  password: strongPasswordSchema,
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
