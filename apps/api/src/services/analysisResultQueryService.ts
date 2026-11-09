import {
  bandFromScore,
  buildUntrackableAdvice,
  formAnalysisResponseSchema,
  recordedSetListSchema,
  isFormAnalysisExercise,
  FORM_DIMENSIONS,
  UNTRACKABLE_REASONS,
  type FormAnalysisResponse,
  type RecordedSet,
  type UntrackableReason,
} from "@repo/common";
import { getPrismaClient, SessionStatus } from "@repo/db";

import { ConflictError, InternalError, NotFoundError } from "../errors";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";
import {
  storedRawFeedbackSchema,
  storedScoreBreakdownSchema,
} from "../utils/storedAnalysis";

const RECORDED_SETS_LIMIT = 50;

const isUntrackableReason = (value: string): value is UntrackableReason =>
  (UNTRACKABLE_REASONS as readonly string[]).indexOf(value) !== -1;

/**
 * Read side of form analysis: maps stored rows to the shared response shapes.
 * `formScore` is deliberately never copied into a response (FORM-04).
 */
export class AnalysisResultQueryService {
  private get prisma() {
    return getPrismaClient();
  }

  async getSessionAnalysis(
    userUuid: string,
    sessionId: number,
  ): Promise<FormAnalysisResponse> {
    const userId = await getUserIdByUuid(this.prisma, userUuid);

    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        workoutId: true,
        setNumber: true,
        processingStatus: true,
        exercise: { select: { code: true, displayName: true } },
        analysisResult: {
          select: {
            outcome: true,
            formScore: true,
            scoreBreakdown: true,
            summaryFeedback: true,
            rawFeedback: true,
            untrackableReasons: true,
            analyzedAt: true,
            findings: {
              orderBy: [{ findingType: "asc" }, { sortOrder: "asc" }],
              select: {
                findingType: true,
                severity: true,
                code: true,
                title: true,
                description: true,
                correction: true,
                repNumbers: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundError("Workout session not found");
    }

    const result = session.analysisResult;
    if (session.processingStatus !== SessionStatus.COMPLETED || !result) {
      throw new ConflictError(
        "Analysis is not ready yet",
        "ANALYSIS_NOT_READY",
      );
    }

    const exerciseCode = session.exercise.code;
    const base = {
      sessionId: session.id,
      workoutId: session.workoutId,
      setNumber: session.setNumber,
      exerciseCode,
      exerciseDisplayName: session.exercise.displayName,
      analyzedAt: result.analyzedAt.toISOString(),
    };

    if (result.outcome === "UNTRACKABLE") {
      if (!isFormAnalysisExercise(exerciseCode)) {
        throw new InternalError("Stored analysis is not readable");
      }
      const reasons = result.untrackableReasons.filter(isUntrackableReason);
      return this.validated({
        ...base,
        outcome: "UNTRACKABLE",
        reasons,
        advice: buildUntrackableAdvice(reasons, exerciseCode),
      });
    }

    const breakdown = storedScoreBreakdownSchema.safeParse(
      result.scoreBreakdown,
    );
    const rawFeedback = storedRawFeedbackSchema.safeParse(result.rawFeedback);
    if (
      !breakdown.success ||
      !rawFeedback.success ||
      result.formScore === null
    ) {
      throw new InternalError("Stored analysis is not readable");
    }

    const findings = [...result.findings].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    return this.validated({
      ...base,
      outcome: "SCORED",
      band: bandFromScore(result.formScore),
      repCount: rawFeedback.data.repCount,
      summary: result.summaryFeedback ?? "",
      dimensions: FORM_DIMENSIONS.map((dimension) => {
        const { score, isAssessed } = breakdown.data[dimension];
        return {
          dimension,
          band: isAssessed && score !== null ? bandFromScore(score) : null,
          isAssessed,
        };
      }),
      positives: findings
        .filter((finding) => finding.findingType === "POSITIVE")
        .map((finding) => ({
          text: finding.description,
          repNumbers: finding.repNumbers,
        })),
      corrections: findings
        .filter((finding) => finding.findingType === "CORRECTION")
        .map((finding) => ({
          code: finding.code ?? "",
          title: finding.title,
          cue: finding.correction ?? "",
          detail: finding.description,
          severity: finding.severity,
          repNumbers: finding.repNumbers,
        })),
    });
  }

  async listRecordedSets(
    userUuid: string,
    workoutId: number,
  ): Promise<RecordedSet[]> {
    const userId = await getUserIdByUuid(this.prisma, userUuid);

    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      select: { id: true },
    });
    if (!workout) {
      throw new NotFoundError("Workout not found");
    }

    const sessions = await this.prisma.workoutSession.findMany({
      where: { workoutId, userId },
      orderBy: [{ performedAt: "desc" }, { id: "desc" }],
      take: RECORDED_SETS_LIMIT,
      select: {
        id: true,
        workoutId: true,
        setNumber: true,
        performedAt: true,
        processingStatus: true,
        analysisStage: true,
        analysisStageProgress: true,
        failureReason: true,
        bullmqJobId: true,
        exercise: { select: { code: true, displayName: true } },
        analysisResult: { select: { outcome: true, formScore: true } },
      },
    });

    const parsed = recordedSetListSchema.safeParse(
      sessions.map((session) => {
        const result = session.analysisResult;
        return {
          sessionId: session.id,
          workoutId: session.workoutId,
          setNumber: session.setNumber,
          exerciseCode: session.exercise.code,
          exerciseDisplayName: session.exercise.displayName,
          performedAt: session.performedAt.toISOString(),
          processingStatus: session.processingStatus,
          analysisStage: session.analysisStage,
          analysisStageProgress: session.analysisStageProgress,
          failureReason: session.failureReason,
          bullmqJobId: session.bullmqJobId,
          outcome: result?.outcome ?? null,
          band:
            result?.outcome === "SCORED" && result.formScore !== null
              ? bandFromScore(result.formScore)
              : null,
        };
      }),
    );
    if (!parsed.success) {
      throw new InternalError("Recorded sets are not readable");
    }
    return parsed.data;
  }

  /** Parsing strips anything extra and guarantees the shared shape. */
  private validated(candidate: unknown): FormAnalysisResponse {
    const parsed = formAnalysisResponseSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new InternalError("Stored analysis is not readable");
    }
    return parsed.data;
  }
}

export default new AnalysisResultQueryService();
