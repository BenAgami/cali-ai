export const userKeys = {
  all: ["user"] as const,
  me: () => ["user", "me"] as const,
  byId: (id: string) => ["user", id] as const,
};

export const workoutKeys = {
  all: ["workouts"] as const,
  lists: () => ["workouts", "list"] as const,
  detail: (id: number) => ["workouts", id] as const,
};

export const analysisKeys = {
  all: ["analysis"] as const,
  session: (sessionId: number) => ["analysis", "session", sessionId] as const,
  recordedSets: (workoutId: number) =>
    ["analysis", "recordedSets", workoutId] as const,
};

export const exerciseKeys = {
  all: ["exercises"] as const,
  lists: () => ["exercises", "list"] as const,
  list: (params: { search?: string; type?: string }) =>
    ["exercises", "list", params] as const,
  detail: (code: string) => ["exercises", "detail", code] as const,
};
