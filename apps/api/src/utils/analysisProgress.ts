import type { AnalysisStage, AnalysisStatusEvent } from "@repo/common";
import { SessionStatus } from "@repo/db";

// The single stage-to-percent table (D-07). Ranges are contiguous so the
// percent never jumps backward between stages. Percent is never persisted.
const STAGE_PERCENT_RANGES: Record<AnalysisStage, readonly [number, number]> = {
  QUEUED: [0, 10],
  ANALYZING_REPS: [10, 60],
  WRITING_FEEDBACK: [60, 95],
  COMPLETED: [100, 100],
};

const STAGE_LABELS: Record<AnalysisStage, string> = {
  QUEUED: "queued",
  ANALYZING_REPS: "analyzing reps",
  WRITING_FEEDBACK: "writing feedback",
  COMPLETED: "done",
};

const MAX_IN_PROGRESS_PERCENT = 99;

export type AnalysisSnapshot = {
  id: number;
  processingStatus: SessionStatus;
  analysisStage: AnalysisStage | null;
  analysisStageProgress: number | null;
  failureReason: string | null;
};

export const progressPercent = (
  stage: AnalysisStage,
  subProgress?: number | null,
): number => {
  if (stage === "COMPLETED") return 100;

  const [low, high] = STAGE_PERCENT_RANGES[stage];
  const fraction =
    typeof subProgress === "number" && Number.isFinite(subProgress)
      ? Math.min(1, Math.max(0, subProgress))
      : 0;

  return Math.min(
    Math.round(low + (high - low) * fraction),
    MAX_IN_PROGRESS_PERCENT,
  );
};

export const toStatusEvent = (
  snapshot: AnalysisSnapshot,
): AnalysisStatusEvent | null => {
  const { processingStatus } = snapshot;

  if (processingStatus === SessionStatus.PENDING) return null;

  const base = { sessionId: snapshot.id };

  if (processingStatus === SessionStatus.COMPLETED) {
    return {
      ...base,
      status: "COMPLETED",
      stage: "COMPLETED",
      stage_label: STAGE_LABELS.COMPLETED,
      progress_percent: 100,
      failure_reason: null,
    };
  }

  const stage = snapshot.analysisStage ?? "QUEUED";
  const percent = progressPercent(stage, snapshot.analysisStageProgress);

  if (processingStatus === SessionStatus.FAILED) {
    return {
      ...base,
      status: "FAILED",
      stage,
      stage_label: STAGE_LABELS[stage],
      progress_percent: Math.min(percent, MAX_IN_PROGRESS_PERCENT),
      failure_reason: snapshot.failureReason,
    };
  }

  return {
    ...base,
    status: stage === "QUEUED" ? "QUEUED" : "PROCESSING",
    stage,
    stage_label: STAGE_LABELS[stage],
    progress_percent: percent,
    failure_reason: null,
  };
};
