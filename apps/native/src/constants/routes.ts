export const AUTH_ROUTES = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  logout: "/api/auth/logout",
} as const;

export const USER_ROUTES = {
  me: "/api/users/me",
  avatarUploadUrl: "/api/users/me/avatar-upload-url",
  goals: "/api/users/me/goals",
  bodyMetrics: "/api/users/me/body-metrics",
  aiConsent: "/api/users/me/ai-consent",
} as const;

export const EXERCISE_ROUTES = {
  list: "/api/exercises",
  byCode: (code: string) => `/api/exercises/${encodeURIComponent(code)}`,
} as const;

export const WORKOUT_PLAN_ROUTES = {
  list: "/api/workout-plans",
  generate: "/api/workout-plans/generate",
  detail: (id: number) => `/api/workout-plans/${id}`,
  runs: (id: number) => `/api/workout-plans/${id}/runs`,
  run: (id: number, runId: number) => `/api/workout-plans/${id}/runs/${runId}`,
  recordedSets: (id: number) => `/api/workout-plans/${id}/recorded-sets`,
} as const;

export const RECORDED_SET_ROUTES = {
  list: "/api/recorded-sets",
  create: "/api/recorded-sets",
  capture: (id: number) => `/api/recorded-sets/${id}/capture`,
  status: (id: number) => `/api/recorded-sets/${id}/status`,
  analysis: (id: number) => `/api/recorded-sets/${id}/analysis`,
  retry: (id: number) => `/api/recorded-sets/${id}/analysis/retry`,
} as const;
