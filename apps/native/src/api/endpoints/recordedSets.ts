import type {
  CaptureAccepted,
  CreateRecordedSetValues,
  FormAnalysisResponse,
  PoseCapturePayload,
  PROCESSING_STATUSES,
  RecordedSetListResponse,
  RecordedSetResponse,
} from "@repo/common";

import { apiClient } from "../client";
import { withQuery } from "../withQuery";
import { RECORDED_SET_ROUTES } from "@src/constants/routes";

type ProcessingStatusValue = (typeof PROCESSING_STATUSES)[number];

const DEFAULT_LIST_LIMIT = 20;

export const recordedSetsApi = {
  create: (input: CreateRecordedSetValues): Promise<RecordedSetResponse> =>
    apiClient.post<RecordedSetResponse>(RECORDED_SET_ROUTES.create, input),

  submitCapture: (
    recordedSetId: number,
    payload: PoseCapturePayload,
  ): Promise<CaptureAccepted> =>
    apiClient.postGzipJson<CaptureAccepted>(
      RECORDED_SET_ROUTES.capture(recordedSetId),
      payload,
    ),

  retryAnalysis: (recordedSetId: number): Promise<CaptureAccepted> =>
    apiClient.post<CaptureAccepted>(
      RECORDED_SET_ROUTES.retry(recordedSetId),
      {},
    ),

  getAnalysis: (recordedSetId: number): Promise<FormAnalysisResponse> =>
    apiClient.get<FormAnalysisResponse>(
      RECORDED_SET_ROUTES.analysis(recordedSetId),
    ),

  listByStatus: (
    processingStatus: ProcessingStatusValue,
    limit = DEFAULT_LIST_LIMIT,
  ): Promise<RecordedSetListResponse> =>
    apiClient.get<RecordedSetListResponse>(
      withQuery(RECORDED_SET_ROUTES.list, { processingStatus, limit }),
    ),
};
