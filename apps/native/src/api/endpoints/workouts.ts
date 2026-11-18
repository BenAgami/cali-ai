import type {
  CreateWorkoutValues,
  GenerateWorkoutValues,
  WorkoutGenerationPreview,
  UpdateWorkoutValues,
  WorkoutWithExercises,
  WorkoutListResponse,
  WorkoutLogResponse,
  RecordedSetPage,
} from "@repo/common";

import { apiClient } from "../client";
import { withQuery } from "../withQuery";
import { WORKOUT_ROUTES } from "@src/constants/routes";

const GENERATE_TIMEOUT_MS = 75_000;

export const workoutApi = {
  list: (
    params: { limit?: number; offset?: number } = {},
  ): Promise<WorkoutListResponse> =>
    apiClient.get<WorkoutListResponse>(withQuery(WORKOUT_ROUTES.list, params)),

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

  startLog: (id: number): Promise<WorkoutLogResponse> =>
    apiClient.post<WorkoutLogResponse>(WORKOUT_ROUTES.logs(id), {}),

  completeLog: (id: number, logId: number): Promise<WorkoutLogResponse> =>
    apiClient.patch<WorkoutLogResponse>(WORKOUT_ROUTES.log(id, logId), {}),

  recordedSets: (
    workoutId: number,
    workoutLogId?: number,
    offset?: number,
  ): Promise<RecordedSetPage> =>
    apiClient.get<RecordedSetPage>(
      withQuery(WORKOUT_ROUTES.recordedSets(workoutId), {
        workoutLogId,
        offset,
      }),
    ),
};
