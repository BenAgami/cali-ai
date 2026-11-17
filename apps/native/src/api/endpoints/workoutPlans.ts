import type {
  CreateWorkoutPlanValues,
  GenerateWorkoutValues,
  WorkoutGenerationPreview,
  UpdateWorkoutPlanValues,
  WorkoutPlanWithExercises,
  WorkoutPlanListResponse,
  WorkoutRunResponse,
  RecordedSetPage,
} from "@repo/common";

import { apiClient } from "../client";
import { withQuery } from "../withQuery";
import { WORKOUT_PLAN_ROUTES } from "@src/constants/routes";

const GENERATE_TIMEOUT_MS = 75_000;

export const workoutPlanApi = {
  list: (
    params: { limit?: number; offset?: number } = {},
  ): Promise<WorkoutPlanListResponse> =>
    apiClient.get<WorkoutPlanListResponse>(
      withQuery(WORKOUT_PLAN_ROUTES.list, params),
    ),

  get: (id: number): Promise<WorkoutPlanWithExercises> =>
    apiClient.get<WorkoutPlanWithExercises>(WORKOUT_PLAN_ROUTES.detail(id)),

  create: (data: CreateWorkoutPlanValues): Promise<WorkoutPlanWithExercises> =>
    apiClient.post<WorkoutPlanWithExercises>(WORKOUT_PLAN_ROUTES.list, data),

  generate: (data: GenerateWorkoutValues): Promise<WorkoutGenerationPreview> =>
    apiClient.post<WorkoutGenerationPreview>(
      WORKOUT_PLAN_ROUTES.generate,
      data,
      {
        timeoutMs: GENERATE_TIMEOUT_MS,
      },
    ),

  update: (
    id: number,
    data: UpdateWorkoutPlanValues,
  ): Promise<WorkoutPlanWithExercises> =>
    apiClient.patch<WorkoutPlanWithExercises>(
      WORKOUT_PLAN_ROUTES.detail(id),
      data,
    ),

  remove: (id: number): Promise<void> =>
    apiClient.delete<void>(WORKOUT_PLAN_ROUTES.detail(id)),

  startRun: (id: number): Promise<WorkoutRunResponse> =>
    apiClient.post<WorkoutRunResponse>(WORKOUT_PLAN_ROUTES.runs(id), {}),

  completeRun: (id: number, runId: number): Promise<WorkoutRunResponse> =>
    apiClient.patch<WorkoutRunResponse>(WORKOUT_PLAN_ROUTES.run(id, runId), {}),

  recordedSets: (
    workoutPlanId: number,
    workoutRunId?: number,
    offset?: number,
  ): Promise<RecordedSetPage> =>
    apiClient.get<RecordedSetPage>(
      withQuery(WORKOUT_PLAN_ROUTES.recordedSets(workoutPlanId), {
        workoutRunId,
        offset,
      }),
    ),
};
