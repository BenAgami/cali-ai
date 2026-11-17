import type { Prisma } from "@repo/db";

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
 * Write side of form analysis. Writers run inside the caller's transaction
 * (`analysisStateService.completeRunWithResult`), which holds the run guard and
 * commits the result together with COMPLETED, so BullMQ retries and the retry
 * endpoint never duplicate findings and a superseded run writes nothing.
 * The JSON columns are built with the stored schemas the read side parses.
 */
export class FormAnalysisResultService {
  async saveScored(
    tx: Prisma.TransactionClient,
    recordedSetId: number,
    metrics: ScoredFormMetrics,
    outcome: FormFeedbackOutcome,
  ): Promise<void> {
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
      where: { recordedSetId },
      create: { recordedSetId, ...data },
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
  }

  async saveUntrackable(
    tx: Prisma.TransactionClient,
    recordedSetId: number,
    metrics: UntrackableFormMetrics,
  ): Promise<void> {
    const rawFeedback = storedRawFeedbackSchema.parse({
      metricsVersion: metrics.metricsVersion,
      rubricVersion: metrics.rubricVersion,
      promptVersion: null,
      repCount: 0,
      droppedRepCount: 0,
      reps: [],
      llmUsage: null,
    });

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
      where: { recordedSetId },
      create: { recordedSetId, ...data },
      update: data,
      select: { id: true },
    });

    await tx.analysisFinding.deleteMany({
      where: { analysisResultId: result.id },
    });
  }
}

const toStoredDimension = (dimension: {
  score: number | null;
  isAssessed: boolean;
}) => ({ score: dimension.score, isAssessed: dimension.isAssessed });

export default new FormAnalysisResultService();
