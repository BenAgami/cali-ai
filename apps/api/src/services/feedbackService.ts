export type FeedbackInput = {
  frameCount: number;
  keypointsPerFrame: number;
  meanConfidence: number;
};

export type FeedbackDraft = { summary: string };

/**
 * Phase 1 seam. Phase 5 replaces the body with the Claude call (metrics +
 * rubric -> structured feedback). It is async and wrapped in withTimeout by the
 * worker so retry/timeout behaviour is already real.
 */
class FeedbackService {
  generateFeedback(input: FeedbackInput): Promise<FeedbackDraft> {
    return Promise.resolve({
      summary: `Analysis pipeline check: ${input.frameCount} frames, mean keypoint confidence ${input.meanConfidence.toFixed(2)}`,
    });
  }
}

export default new FeedbackService();
