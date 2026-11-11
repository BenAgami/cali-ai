import { getRubric, RUBRIC_VERSION } from "../../../../src/metrics/rubrics";
import { pushUpRubric } from "../../../../src/metrics/rubrics/pushUp";
import type { RepMetrics } from "../../../../src/metrics/types";
import { runRubric, tagLabels } from "../../helpers/rubricRun";

const BASE = { reps: 5, view: "side" as const, aspectRatio: 16 / 9 };

const repsWith = (depths: number[]): RepMetrics[] =>
  depths.map((minElbowDeg, index) => ({
    repNumber: index + 1,
    startSec: index * 2,
    endSec: index * 2 + 1.5,
    durationSec: 1.5,
    features: { minElbowDeg },
    dimensionScores: {},
    tags: [],
  }));

describe("push_up rubric", () => {
  it("is registered with the approved version and assessability", () => {
    expect(RUBRIC_VERSION).toBe("rubric-v1");
    expect(getRubric("push_up").exerciseCode).toBe("push_up");
    expect(pushUpRubric.assessed).toEqual({
      ROM: true,
      CORE: true,
      SYMMETRY: false,
    });
    expect(pushUpRubric.weights).toEqual({ ROM: 0.5, CORE: 0.5, SYMMETRY: 0 });
    expect(pushUpRubric.forbiddenTopics).toEqual(
      expect.arrayContaining(["elbow flare", "injury", "body composition"]),
    );
  });

  it("recovers elbow angles and hip offset from a clean set", () => {
    const run = runRubric(pushUpRubric, {
      ...BASE,
      depthDeg: 90,
      lockoutDeg: 170,
    });
    expect(run.features).toHaveLength(5);
    for (const f of run.features) {
      expect(Math.abs(f.minElbowDeg - 90)).toBeLessThanOrEqual(3);
      expect(Math.abs(f.maxElbowDeg - 170)).toBeLessThanOrEqual(3);
      expect(Math.abs(f.meanHipOffset)).toBeLessThanOrEqual(0.015);
    }
    expect(tagLabels(run).flat()).toEqual([]);
    for (const s of run.scores) {
      expect(s.ROM).toBeGreaterThanOrEqual(95);
      expect(s.CORE).toBeGreaterThanOrEqual(90);
    }
  });

  it.each([
    [110, "PU_SHALLOW_DEPTH:MEDIUM"],
    [125, "PU_SHALLOW_DEPTH:HIGH"],
  ])("tags depth %i", (depthDeg, expected) => {
    const run = runRubric(pushUpRubric, { ...BASE, depthDeg });
    expect(run.features).toHaveLength(5);
    for (const rep of tagLabels(run)) expect(rep).toContain(expected);
  });

  it("tags an incomplete lockout", () => {
    const run = runRubric(pushUpRubric, { ...BASE, lockoutDeg: 150 });
    expect(run.features).toHaveLength(5);
    for (const rep of tagLabels(run))
      expect(rep).toContain("PU_INCOMPLETE_LOCKOUT:MEDIUM");
  });

  it.each([
    [0.09, "PU_HIP_SAG:MEDIUM"],
    [0.14, "PU_HIP_SAG:HIGH"],
    [-0.1, "PU_HIP_PIKE:MEDIUM"],
  ])("tags hip offset %f", (hipOffset, expected) => {
    const run = runRubric(pushUpRubric, { ...BASE, hipOffset });
    expect(run.features).toHaveLength(5);
    for (const rep of tagLabels(run)) expect(rep).toContain(expected);
  });

  it("recovers hip offset sign and size", () => {
    const sag = runRubric(pushUpRubric, { ...BASE, hipOffset: 0.09 });
    const pike = runRubric(pushUpRubric, { ...BASE, hipOffset: -0.1 });
    for (const f of sag.features)
      expect(Math.abs(f.meanHipOffset - 0.09)).toBeLessThanOrEqual(0.02);
    for (const f of pike.features)
      expect(Math.abs(f.meanHipOffset + 0.1)).toBeLessThanOrEqual(0.02);
  });

  it("tags rushed tempo as LOW", () => {
    const run = runRubric(pushUpRubric, { ...BASE, repSec: 1.2 });
    expect(run.features.length).toBeGreaterThanOrEqual(4);
    for (const rep of tagLabels(run))
      expect(rep).toContain("PU_RUSHED_TEMPO:LOW");
  });

  describe("FATIGUE_DROP", () => {
    const [rule] = pushUpRubric.setTags;

    it("fires when the last 2 reps are shallower than the first 2", () => {
      expect(rule.evaluate(repsWith([90, 90, 95, 95, 110, 110]))).toEqual({
        severity: "MEDIUM",
        repNumbers: [5, 6],
      });
    });

    it("needs at least 4 reps", () => {
      expect(rule.evaluate(repsWith([90, 110, 120]))).toBeNull();
    });

    it("does not fire for a small drop", () => {
      expect(rule.evaluate(repsWith([90, 90, 95, 95, 95, 95]))).toBeNull();
    });
  });
});
