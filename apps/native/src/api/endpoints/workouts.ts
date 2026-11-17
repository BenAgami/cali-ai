import type {
  CreateWorkoutValues,
  GenerateWorkoutValues,
  WorkoutGenerationPreview,
  UpdateWorkoutValues,
  WorkoutWithExercises,
  WorkoutListResponse,
  WorkoutRunResponse,
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

  startRun: (id: number): Promise<WorkoutRunResponse> =>
    apiClient.post<WorkoutRunResponse>(WORKOUT_ROUTES.runs(id), {}),

  completeRun: (id: number, runId: number): Promise<WorkoutRunResponse> =>
    apiClient.patch<WorkoutRunResponse>(WORKOUT_ROUTES.run(id, runId), {}),

  recordedSets: (
    workoutId: number,
    workoutRunId?: number,
    offset?: number,
  ): Promise<RecordedSetPage> =>
    apiClient.get<RecordedSetPage>(
      withQuery(WORKOUT_ROUTES.recordedSets(workoutId), {
        workoutRunId,
        offset,
      }),
    ),
};
