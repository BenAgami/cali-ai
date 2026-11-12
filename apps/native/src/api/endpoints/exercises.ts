import type { ExerciseDetail, ExerciseListResponse } from "@repo/common";

import { apiClient } from "../client";
import { withQuery } from "../withQuery";
import { EXERCISE_ROUTES } from "@src/constants/routes";

export const exerciseApi = {
  list: (
    params: { limit?: number; offset?: number } = {},
  ): Promise<ExerciseListResponse> =>
    apiClient.get<ExerciseListResponse>(
      withQuery(EXERCISE_ROUTES.list, params),
    ),

  getByCode: (code: string): Promise<ExerciseDetail> =>
    apiClient.get<ExerciseDetail>(EXERCISE_ROUTES.byCode(code)),
};
