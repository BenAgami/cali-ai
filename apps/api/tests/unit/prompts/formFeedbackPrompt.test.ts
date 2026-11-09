import {
  buildFormFeedbackPrompt,
  FORM_FEEDBACK_PROMPT_VERSION,
  type FormFeedbackContext,
} from "../../../src/prompts/formFeedbackPrompt";
import { makeScoredMetrics } from "../helpers/scoredMetrics";

const context: FormFeedbackContext = {
  exerciseDisplayName: "Push-up",
  experienceLevel: "BEGINNER",
  heightCm: 180,
  weightKg: 75,
};

describe("buildFormFeedbackPrompt", () => {
  it("exposes the prompt version", () => {
    expect(FORM_FEEDBACK_PROMPT_VERSION).toBe("form-feedback-v1");
  });

  it("includes profile context in the user prompt (PROF-07)", () => {
    const { user } = buildFormFeedbackPrompt({
      metrics: makeScoredMetrics(),
      context,
    });

    expect(user).toContain('"heightCm": 180');
    expect(user).toContain('"weightKg": 75');
    expect(user).toContain("BEGINNER");
  });

  it("includes every correction and positive candidate", () => {
    const metrics = makeScoredMetrics();
    const { user } = buildFormFeedbackPrompt({ metrics, context });

    for (const c of metrics.corrections) {
      expect(user).toContain(c.tag);
      expect(user).toContain(c.label);
      expect(user).toContain(c.cue);
    }
    for (const p of metrics.positives) expect(user).toContain(p.text);
    expect(user).toContain("not assessed");
  });

  it("never leaks keypoints, frames or scores (D-19)", () => {
    const { user } = buildFormFeedbackPrompt({
      metrics: makeScoredMetrics(),
      context,
    });

    expect(user).not.toMatch(/keypoints|frames|score/i);
    expect(user).not.toContain("61");
  });

  it("states the hard rules and forbidden topics in the system prompt", () => {
    const { system } = buildFormFeedbackPrompt({
      metrics: makeScoredMetrics(),
      context,
    });

    expect(system).toContain("second person");
    expect(system).toContain("at least one");
    expect(system).toContain("only the rep numbers");
    expect(system).toContain("no medical");
    expect(system).toContain("shoulder impingement");
    expect(system).toContain("wrist pain");
  });

  it("appends previous issues as a final section", () => {
    const { user } = buildFormFeedbackPrompt({
      metrics: makeScoredMetrics(),
      context,
      previousIssues: ["Include at least one positive observation"],
    });

    expect(user).toMatch(
      /Your previous answer had these problems; fix all of them:\n- Include at least one positive observation$/,
    );
  });

  it("omits the issues section when there are none", () => {
    const { user } = buildFormFeedbackPrompt({
      metrics: makeScoredMetrics(),
      context,
      previousIssues: [],
    });

    expect(user).not.toContain("previous answer");
  });
});
