import { z } from "zod";

export const EXPERIENCE_LEVELS = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const GOAL_TYPES = [
  "SKILL",
  "STRENGTH",
  "ENDURANCE",
  "MOBILITY",
  "CONSISTENCY",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const updateProfileSchema = z
  .object({
    username: z.string().trim().min(3).max(30).optional(),
    avatarUrl: z.url().optional(),
    experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field required",
  });

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>;

export const upsertGoalSchema = z.object({
  goalType: z.enum(GOAL_TYPES),
  title: z.string().trim().min(1).max(100),
  targetValue: z.number().positive().optional(),
  targetUnit: z.string().trim().max(30).optional(),
});

export type UpsertGoalValues = z.infer<typeof upsertGoalSchema>;

export const goalSchema = z.object({
  goalType: z.enum(GOAL_TYPES),
  title: z.string(),
  targetValue: z.number().nullable(),
  targetUnit: z.string().nullable(),
});

export type Goal = z.infer<typeof goalSchema>;

export const userProfileSchema = z.object({
  uuid: z.uuid(),
  username: z.string(),
  email: z.email(),
  fullName: z.string(),
  avatarUrl: z.url().nullable(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  goals: z.array(goalSchema),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
