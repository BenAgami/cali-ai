import { z } from "zod";

export const updateProfileSchema = z
  .object({
    username: z.string().trim().min(3).max(30).optional(),
    avatarUrl: z.string().url().optional(),
    experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field required",
  });

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>;

export const upsertGoalSchema = z.object({
  goalType: z.enum(["SKILL", "STRENGTH", "ENDURANCE", "MOBILITY", "CONSISTENCY"]),
  title: z.string().trim().min(1).max(100),
  targetValue: z.number().positive().optional(),
  targetUnit: z.string().trim().max(30).optional(),
});

export type UpsertGoalValues = z.infer<typeof upsertGoalSchema>;
