import type {
  CreateWorkoutValues,
  GenerateWorkoutValues,
  WorkoutGenerationPreview,
  UpdateWorkoutValues,
  WorkoutLogValues,
  WorkoutWithExercises,
  WorkoutListResponse,
  WorkoutLogResponse,
} from "@repo/common";

import { apiClient } from "../client";
import { WORKOUT_ROUTES } from "@src/constants/routes";

// Above the server's 60 s generation deadline so the server error wins.
const GENERATE_TIMEOUT_MS = 75_000;

export const workoutApi = {
  list: (params?: {
    limit?: number;
    offset?: number;
  }): Promise<WorkoutListResponse> => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.offset !== undefined)
      query.set("offset", String(params.offset));
    const qs = query.toString();
    return apiClient.get<WorkoutListResponse>(
      qs ? `${WORKOUT_ROUTES.list}?${qs}` : WORKOUT_ROUTES.list,
    );
  },

  get: (id: number): Promise<WorkoutWithExercises> =>
    apiClient.get<WorkoutWithExercises>(WORKOUT_ROUTES.detail(id)),

  create: (data: CreateWorkoutValues): Promise<WorkoutWithExercises> =>
    apiClient.post<WorkoutWithExercises>(WORKOUT_ROUTES.list, data),

  generate: (data: GenerateWorkoutValues): Promise<WorkoutGenerationPreview> =>
    apiClient.post<WorkoutGenerationPreview>(WORKOUT_ROUTES.generate, data, {
      timeoutMs: GENERATE_TIMEOUT_MS,
    }),

  update: (
    id: number,
    data: UpdateWorkoutValues,
  ): Promise<WorkoutWithExercises> =>
    apiClient.patch<WorkoutWithExercises>(WORKOUT_ROUTES.detail(id), data),

  remove: (id: number): Promise<void> =>
    apiClient.delete<void>(WORKOUT_ROUTES.detail(id)),

  startLog: (id: number, data: WorkoutLogValues): Promise<WorkoutLogResponse> =>
    apiClient.post<WorkoutLogResponse>(WORKOUT_ROUTES.logs(id), data),
};
