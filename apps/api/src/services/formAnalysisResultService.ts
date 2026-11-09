import { getPrismaClient, SessionStatus, type Prisma } from "@repo/db";

import type { FormFeedbackOutcome } from "./feedbackService";
import type {
  ScoredFormMetrics,
  UntrackableFormMetrics,
} from "../metrics/types";
import {
  storedRawFeedbackSchema,
  storedScoreBreakdownSchema,
} from "../utils/storedAnalysis";

const POSITIVE_TITLE = "What went well";

/**
 * Write side of form analysis. Every write runs in one transaction behind the
 * run guard (status PROCESSING and this job's id), so BullMQ retries and the
 * retry endpoint never duplicate findings and a superseded run writes nothing.
 * The JSON columns are built with the stored schemas the read side parses.
 */
export class FormAnalysisResultService {
  private get prisma() {
    return getPrismaClient();
  }

  async saveScored(
    sessionId: number,
    jobId: string,
    metrics: ScoredFormMetrics,
    outcome: FormFeedbackOutcome,
  ): Promise<boolean> {
    const { feedback } = outcome;

    const scoreBreakdown = storedScoreBreakdownSchema.parse({
      ROM: toStoredDimension(metrics.dimensions.ROM),
      CORE: toStoredDimension(metrics.dimensions.CORE),
      SYMMETRY: toStoredDimension(metrics.dimensions.SYMMETRY),
    });
    const rawFeedback = storedRawFeedbackSchema.parse({
      metricsVersion: metrics.metricsVersion,
      rubricVersion: metrics.rubricVersion,
      promptVersion: outcome.promptVersion,
      repCount: metrics.repCount,
      droppedRepCount: metrics.droppedRepCount,
      reps: metrics.reps,
      llmUsage: outcome.usage,
    });

    const positives = feedback.positives.map((positive, index) => ({
      findingType: "POSITIVE" as const,
      severity: "LOW" as const,
      title: POSITIVE_TITLE,
      description: positive.text,
      repNumbers: positive.repNumbers,
      sortOrder: index,
    }));

    const corrections = feedback.corrections.map((correction, index) => {
      const firstRep = metrics.reps.find(
        (rep) => rep.repNumber === correction.repNumbers[0],
      );
      return {
        findingType: "CORRECTION" as const,
        severity: correction.severity,
        code: correction.tag,
        title: correction.title,
        description: correction.detail,
        correction: correction.cue,
        repNumbers: correction.repNumbers,
        startSec: firstRep?.startSec ?? null,
        endSec: firstRep?.endSec ?? null,
        sortOrder: index,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      const isCurrentRun = await this.isCurrentRun(tx, sessionId, jobId);
      if (!isCurrentRun) return false;

      const data = {
        outcome: "SCORED" as const,
        formScore: metrics.overallScore,
        scoreBreakdown,
        summaryFeedback: feedback.summary,
        rawFeedback: rawFeedback as Prisma.InputJsonObject,
        aiModelName: outcome.model,
        untrackableReasons: [],
        analyzedAt: new Date(),
      };
      const result = await tx.analysisResult.upsert({
        where: { sessionId },
        create: { sessionId, ...data },
        update: data,
        select: { id: true },
      });

      await tx.analysisFinding.deleteMany({
        where: { analysisResultId: result.id },
      });
      await tx.analysisFinding.createMany({
        data: [...positives, ...corrections].map((finding) => ({
          analysisResultId: result.id,
          ...finding,
        })),
      });
      return true;
    });
  }

  async saveUntrackable(
    sessionId: number,
    jobId: string,
    metrics: UntrackableFormMetrics,
  ): Promise<boolean> {
    const rawFeedback = storedRawFeedbackSchema.parse({
      metricsVersion: metrics.metricsVersion,
      rubricVersion: metrics.rubricVersion,
      promptVersion: null,
      repCount: 0,
      droppedRepCount: 0,
      reps: [],
      llmUsage: null,
    });

    return this.prisma.$transaction(async (tx) => {
      const isCurrentRun = await this.isCurrentRun(tx, sessionId, jobId);
      if (!isCurrentRun) return false;

      const data = {
        outcome: "UNTRACKABLE" as const,
        formScore: null,
        scoreBreakdown: {},
        summaryFeedback: null,
        rawFeedback: rawFeedback as Prisma.InputJsonObject,
        aiModelName: null,
        untrackableReasons: metrics.reasons,
        analyzedAt: new Date(),
      };
      const result = await tx.analysisResult.upsert({
        where: { sessionId },
        create: { sessionId, ...data },
        update: data,
        select: { id: true },
      });

      await tx.analysisFinding.deleteMany({
        where: { analysisResultId: result.id },
      });
      return true;
    });
  }

  private async isCurrentRun(
    tx: Prisma.TransactionClient,
    sessionId: number,
    jobId: string,
  ): Promise<boolean> {
    const count = await tx.workoutSession.count({
      where: {
        id: sessionId,
        processingStatus: SessionStatus.PROCESSING,
        bullmqJobId: jobId,
      },
    });
    return count > 0;
  }
}

const toStoredDimension = (dimension: {
  score: number | null;
  isAssessed: boolean;
}) => ({ score: dimension.score, isAssessed: dimension.isAssessed });

export default new FormAnalysisResultService();
