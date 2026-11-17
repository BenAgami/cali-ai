export const userKeys = {
  all: ["user"] as const,
  me: () => ["user", "me"] as const,
  byId: (id: string) => ["user", id] as const,
};

export const workoutPlanKeys = {
  all: ["workoutPlans"] as const,
  lists: () => ["workoutPlans", "list"] as const,
  detail: (id: number) => ["workoutPlans", id] as const,
};

export const analysisKeys = {
  all: ["analysis"] as const,
  recordedSet: (recordedSetId: number) =>
    ["analysis", "recorded set", recordedSetId] as const,
  /** A run key extends recordedSets(workoutPlanId), so invalidating that key covers every run of the workout. */
  recordedSets: (workoutPlanId: number, runId?: number) =>
    runId === undefined
      ? (["analysis", "recordedSets", workoutPlanId] as const)
      : (["analysis", "recordedSets", workoutPlanId, runId] as const),
};

export const exerciseKeys = {
  all: ["exercises"] as const,
  lists: () => ["exercises", "list"] as const,
  list: (params: { search?: string; type?: string }) =>
    ["exercises", "list", params] as const,
  detail: (code: string) => ["exercises", "detail", code] as const,
};
