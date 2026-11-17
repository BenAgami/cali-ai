import {
  bandFromScore,
  buildUntrackableAdvice,
  formAnalysisResponseSchema,
  recordedSetPageSchema,
  isFormAnalysisExercise,
  FORM_DIMENSIONS,
  UNTRACKABLE_REASONS,
  type FormAnalysisResponse,
  type RecordedSetPage,
  type RecordedSetsQuery,
  type UntrackableReason,
} from "@repo/common";
import { getPrismaClient, SessionStatus } from "@repo/db";

import { ConflictError, InternalError, NotFoundError } from "../errors";
import { getUserIdByUuid } from "../utils/getUserIdByUuid";
import { lookAheadTake, paginate } from "../utils/pagination";
import {
  storedRawFeedbackSchema,
  storedScoreBreakdownSchema,
} from "../utils/storedAnalysis";

const isUntrackableReason = (value: string): value is UntrackableReason =>
  (UNTRACKABLE_REASONS as readonly string[]).includes(value);

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
        workoutRun: { select: { id: true, completedAt: true } },
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
      openWorkoutRunId:
        session.workoutRun?.completedAt === null ? session.workoutRun.id : null,
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

    // The query orders by findingType then sortOrder, so each filtered subset
    // below is already in sortOrder.
    const { findings } = result;

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
    query: RecordedSetsQuery,
  ): Promise<RecordedSetPage> {
    const userId = await getUserIdByUuid(this.prisma, userUuid);

    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      select: { id: true },
    });
    if (!workout) {
      throw new NotFoundError("Workout not found");
    }

    const sessions = await this.prisma.workoutSession.findMany({
      // PENDING means no capture was accepted, so there is nothing to show.
      where: {
        workoutId,
        userId,
        workoutRunId: query.workoutRunId,
        processingStatus: { not: SessionStatus.PENDING },
      },
      orderBy: [{ performedAt: "desc" }, { id: "desc" }],
      skip: query.offset,
      take: lookAheadTake(query.limit),
      select: {
        id: true,
        workoutId: true,
        workoutRunId: true,
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

    const mapped = sessions.map((session) => {
      const result = session.analysisResult;
      return {
        sessionId: session.id,
        workoutId: session.workoutId,
        workoutRunId: session.workoutRunId,
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
    });

    const parsed = recordedSetPageSchema.safeParse(
      paginate(mapped, query.limit, query.offset),
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
