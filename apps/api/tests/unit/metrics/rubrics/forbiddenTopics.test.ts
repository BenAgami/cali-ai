import { FORM_ANALYSIS_EXERCISES } from "@repo/common";

import { getRubric } from "../../../../src/metrics/rubrics";

// The model quotes a correction's label and cue, and feedback validation
// rejects any text naming a forbidden topic. Rubric wording that contains one
// (e.g. "knee height" vs the forbidden topic "height") made squat sets fail.
describe.each(FORM_ANALYSIS_EXERCISES)("%s rubric wording", (exerciseCode) => {
  it("never contains one of its own forbidden topics", () => {
    const rubric = getRubric(exerciseCode);
    const patterns = rubric.forbiddenTopics.map(
      (topic) =>
        new RegExp(
          `\\b${topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        ),
    );

    for (const rule of [...rubric.repTags, ...rubric.setTags]) {
      for (const text of [rule.label, rule.cue]) {
        const hit = patterns.find((pattern) => pattern.test(text));
        expect(hit, `${rule.tag}: "${text}"`).toBeUndefined();
      }
    }
  });
});
