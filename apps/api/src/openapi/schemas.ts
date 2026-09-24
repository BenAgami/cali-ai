import { registry } from "./registry";

import { z } from "zod";

import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  logoutSchema,
  updateProfileSchema,
  upsertGoalSchema,
  createWorkoutSchema,
  updateWorkoutSchema,
  workoutLogSchema,
  createWorkoutSessionSchema,
  EXPERIENCE_LEVELS,
  GOAL_TYPES,
  EXERCISE_TYPES,
  exerciseDetailSchema,
  workoutWithExercisesSchema,
  workoutLogResponseSchema,
  pageMetaSchema,
} from "@repo/common";

import { Role, GoalStatus, SessionStatus } from "@repo/db";

// ── Primitive helpers ─────────────────────────────────────────────────────────

const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [string, ...string[]];

const isoDateTime = () =>
  z
    .string()
    .openapi({ format: "date-time", example: "2026-06-27T12:34:56.000Z" });

const decimalString = () =>
  z.string().openapi({
    description: "Decimal value serialized as a string",
    example: "12.50",
  });

const RoleEnum = z.enum(enumValues(Role));
const ExperienceLevelEnum = z.enum(EXPERIENCE_LEVELS);
const GoalTypeEnum = z.enum(GOAL_TYPES);
const GoalStatusEnum = z.enum(enumValues(GoalStatus));
const ExerciseTypeEnum = z.enum(EXERCISE_TYPES);
const SessionStatusEnum = z.enum(enumValues(SessionStatus));

// ── Request bodies (reuse the shared @repo/common schemas) ────────────────────

export const LoginBody = registry.register("LoginBody", loginSchema);
export const RegisterBody = registry.register("RegisterBody", registerSchema);
export const RefreshTokenBody = registry.register(
  "RefreshTokenBody",
  refreshTokenSchema,
);
export const LogoutBody = registry.register("LogoutBody", logoutSchema);
export const UpdateProfileBody = registry.register(
  "UpdateProfileBody",
  updateProfileSchema,
);
export const UpsertGoalBody = registry.register(
  "UpsertGoalBody",
  upsertGoalSchema,
);
export const CreateWorkoutBody = registry.register(
  "CreateWorkoutBody",
  createWorkoutSchema,
);
export const UpdateWorkoutBody = registry.register(
  "UpdateWorkoutBody",
  updateWorkoutSchema,
);
export const WorkoutLogBody = registry.register(
  "WorkoutLogBody",
  workoutLogSchema,
);
export const CreateWorkoutSessionBody = registry.register(
  "CreateWorkoutSessionBody",
  createWorkoutSessionSchema,
);

// ── Response envelope ─────────────────────────────────────────────────────────

const ErrorResponse = registry.register(
  "ErrorResponse",
  z.object({
    success: z.literal(false),
    message: z.string(),
    code: z.string(),
  }),
);

export const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorResponse } },
});

export const successResponse = (
  dataSchema: z.ZodTypeAny,
  description: string,
) => ({
  description,
  content: {
    "application/json": {
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        data: dataSchema,
      }),
    },
  },
});

export const messageResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
      }),
    },
  },
});

const PageMeta = registry.register("PageMeta", pageMetaSchema);

export const paginatedData = (itemSchema: z.ZodTypeAny) =>
  z.object({
    items: z.array(itemSchema),
    page: PageMeta,
  });

// ── Auth responses ────────────────────────────────────────────────────────────

const RegisterUser = z.object({
  id: z.number().int(),
  uuid: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  username: z.string(),
  createdAt: isoDateTime(),
  role: RoleEnum,
});

const LoginUser = z.object({
  id: z.number().int(),
  uuid: z.uuid(),
  email: z.email(),
  username: z.string(),
  fullName: z.string(),
  role: RoleEnum,
  avatarUrl: z.string().nullable(),
  experienceLevel: ExperienceLevelEnum,
  createdAt: isoDateTime(),
  updatedAt: isoDateTime(),
});

export const RegisterResponse = registry.register(
  "RegisterResponse",
  z.object({
    user: RegisterUser,
    token: z.string(),
    refreshToken: z.string(),
  }),
);

export const LoginResponse = registry.register(
  "LoginResponse",
  z.object({
    user: LoginUser,
    token: z.string(),
    refreshToken: z.string(),
  }),
);

export const RefreshTokenResponse = registry.register(
  "RefreshTokenResponse",
  z.object({
    token: z.string(),
    refreshToken: z.string(),
  }),
);

// ── User responses ────────────────────────────────────────────────────────────

const GoalSummary = z.object({
  id: z.number().int(),
  goalType: GoalTypeEnum,
  title: z.string(),
  targetValue: decimalString().nullable(),
  targetUnit: z.string().nullable(),
});

export const UserProfileResponse = registry.register(
  "UserProfileResponse",
  z.object({
    id: z.number().int(),
    uuid: z.uuid(),
    email: z.email(),
    fullName: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    experienceLevel: ExperienceLevelEnum,
    createdAt: isoDateTime(),
    updatedAt: isoDateTime(),
    role: RoleEnum,
    goals: z.array(GoalSummary),
  }),
);

export const UpdateProfileResponse = registry.register(
  "UpdateProfileResponse",
  z.object({
    uuid: z.uuid(),
    username: z.string(),
    email: z.email(),
    fullName: z.string(),
    avatarUrl: z.string().nullable(),
    experienceLevel: ExperienceLevelEnum,
    createdAt: isoDateTime(),
    updatedAt: isoDateTime(),
    role: RoleEnum,
  }),
);

export const AvatarUploadUrlResponse = registry.register(
  "AvatarUploadUrlResponse",
  z.object({
    uploadUrl: z.string(),
    key: z.string(),
    publicUrl: z.string(),
  }),
);

export const GoalResponse = registry.register(
  "GoalResponse",
  z.object({
    id: z.number().int(),
    goalType: GoalTypeEnum,
    title: z.string(),
    targetValue: decimalString().nullable(),
    targetUnit: z.string().nullable(),
    status: GoalStatusEnum,
    createdAt: isoDateTime(),
  }),
);

// ── Exercise responses ────────────────────────────────────────────────────────
// Reuses the response shapes shared with apps/native via @repo/common so the
// two clients of this API can't drift apart.

export const ExerciseResponse = registry.register(
  "Exercise",
  exerciseDetailSchema,
);

// ── Workout responses ─────────────────────────────────────────────────────────

export const WorkoutResponse = registry.register(
  "Workout",
  workoutWithExercisesSchema,
);

export const WorkoutLogResponse = registry.register(
  "WorkoutLog",
  workoutLogResponseSchema,
);

// ── Workout session responses ─────────────────────────────────────────────────

const SessionExerciseRef = z.object({
  code: z.string(),
  displayName: z.string(),
  exerciseType: ExerciseTypeEnum,
});

const AnalysisResultSummary = z.object({
  formScore: z.number().int(),
  analyzedAt: isoDateTime(),
  summaryFeedback: z.string().nullable(),
});

export const WorkoutSessionResponse = registry.register(
  "WorkoutSession",
  z.object({
    id: z.number().int(),
    userId: z.number().int(),
    exerciseId: z.number().int(),
    processingStatus: SessionStatusEnum,
    notes: z.string().nullable(),
    performedAt: isoDateTime(),
    videoDurationSec: decimalString().nullable(),
    videoFps: decimalString().nullable(),
    videoWidth: z.number().int().nullable(),
    videoHeight: z.number().int().nullable(),
    videoSizeBytes: z.number().nullable(),
    processingStartedAt: isoDateTime().nullable(),
    processingFinishedAt: isoDateTime().nullable(),
    failureReason: z.string().nullable(),
    videoR2Key: z.string().nullable(),
    bullmqJobId: z.string().nullable(),
    createdAt: isoDateTime(),
    updatedAt: isoDateTime(),
    exercise: SessionExerciseRef,
  }),
);

export const WorkoutSessionListItem = registry.register(
  "WorkoutSessionListItem",
  WorkoutSessionResponse.extend({
    analysisResult: AnalysisResultSummary.nullable(),
  }),
);
