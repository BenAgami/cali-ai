import { FORM_ANALYSIS_EXERCISES } from "@repo/common";

import { getRubric } from "../../../../src/metrics/rubrics";
import { pullUpRubric } from "../../../../src/metrics/rubrics/pullUp";
import type { RepMetrics } from "../../../../src/metrics/types";
import { runRubric, tagLabels } from "../../helpers/rubricRun";

const BASE = { reps: 5, view: "front" as const };

const repsWith = (mouthBelowBar: number[]): RepMetrics[] =>
  mouthBelowBar.map((value, index) => ({
    repNumber: index + 1,
    startSec: index * 2,
    endSec: index * 2 + 1.5,
    durationSec: 1.5,
    features: { mouthBelowBar: value },
    dimensionScores: {},
    tags: [],
  }));

describe("pull_up rubric", () => {
  it("assesses all three dimensions with the approved weights", () => {
    expect(pullUpRubric.assessed).toEqual({
      ROM: true,
      CORE: true,
      SYMMETRY: true,
    });
    expect(pullUpRubric.weights).toEqual({
      ROM: 0.5,
      CORE: 0.1,
      SYMMETRY: 0.4,
    });
    expect(pullUpRubric.forbiddenTopics).toEqual(
      expect.arrayContaining(["kipping", "grip width", "injury"]),
    );
  });

  it("registers a rubric for every form-analysis exercise", () => {
    for (const code of FORM_ANALYSIS_EXERCISES) {
      expect(getRubric(code).exerciseCode).toBe(code);
    }
  });

  it("recovers clearance and symmetry with no tags for a clean set", () => {
    const run = runRubric(pullUpRubric, {
      ...BASE,
      mouthBelowBar: -0.05,
      lockoutDeg: 170,
    });
    expect(run.features).toHaveLength(5);
    for (const f of run.features) {
      // Segmentation smooths the peak, so allow a little under-reach.
      expect(Math.abs(f.mouthBelowBar + 0.05)).toBeLessThanOrEqual(0.04);
      expect(f.maxElbowDeg).toBeGreaterThanOrEqual(165);
      expect(f.meanElbowDiffDeg).toBeLessThan(2);
      expect(f.maxShoulderTiltDeg).toBeLessThan(2);
    }
    expect(tagLabels(run).flat()).toEqual([]);
    for (const s of run.scores) expect(s.SYMMETRY).toBeGreaterThanOrEqual(90);
  });

  it.each([
    [0.08, "PL_CHIN_NOT_OVER_BAR:MEDIUM"],
    [0.2, "PL_CHIN_NOT_OVER_BAR:HIGH"],
  ])("tags mouth %f below the bar", (mouthBelowBar, expected) => {
    const run = runRubric(pullUpRubric, { ...BASE, mouthBelowBar });
    expect(run.features).toHaveLength(5);
    for (const rep of tagLabels(run)) expect(rep).toContain(expected);
  });

  it.each([
    [{ elbowAsymmetryDeg: 15 }, "PL_ASYM_PULL:MEDIUM"],
    // The rep mean sits ~3 deg under the peak gap, so 25 deg clears the >20 line.
    [{ elbowAsymmetryDeg: 25 }, "PL_ASYM_PULL:HIGH"],
    [{ shoulderTiltDeg: 10 }, "PL_ASYM_PULL:MEDIUM"],
  ])("tags %j as asymmetric", (options, expected) => {
    const run = runRubric(pullUpRubric, { ...BASE, ...options });
    expect(run.features).toHaveLength(5);
    for (const rep of tagLabels(run)) expect(rep).toContain(expected);
  });

  it("recovers elbow asymmetry, shoulder tilt and hip sway", () => {
    const asym = runRubric(pullUpRubric, { ...BASE, elbowAsymmetryDeg: 15 });
    for (const f of asym.features)
      expect(Math.abs(f.meanElbowDiffDeg - 15)).toBeLessThanOrEqual(3);
    const tilt = runRubric(pullUpRubric, { ...BASE, shoulderTiltDeg: 10 });
    for (const f of tilt.features)
      expect(Math.abs(f.maxShoulderTiltDeg - 10)).toBeLessThanOrEqual(3);
    // Sway amplitude is per side, so the measured x range is twice the input.
    const sway = runRubric(pullUpRubric, { ...BASE, hipSwayRatio: 0.15 });
    for (const f of sway.features)
      expect(Math.abs(f.hipSwayRatio - 0.3)).toBeLessThanOrEqual(0.03);
  });

  it("tags rushed tempo as LOW", () => {
    const run = runRubric(pullUpRubric, { ...BASE, repSec: 1.6 });
    expect(run.features.length).toBeGreaterThanOrEqual(4);
    for (const rep of tagLabels(run))
      expect(rep).toContain("PL_RUSHED_TEMPO:LOW");
  });

  it("tags an incomplete hang", () => {
    const rule = pullUpRubric.repTags.find((r) => r.tag === "PL_NO_FULL_HANG");
    expect(rule?.evaluate({ maxElbowDeg: 150 })).toBe("MEDIUM");
    expect(rule?.evaluate({ maxElbowDeg: 170 })).toBeNull();
  });

  describe("FATIGUE_DROP", () => {
    const [rule] = pullUpRubric.setTags;

    it("fires when the last 2 reps clear the bar worse than the first 2", () => {
      expect(
        rule.evaluate(repsWith([-0.1, -0.1, -0.05, -0.05, 0.05, 0.05])),
      ).toEqual({ severity: "MEDIUM", repNumbers: [5, 6] });
    });

    it("needs at least 4 reps", () => {
      expect(rule.evaluate(repsWith([-0.1, 0, 0.1]))).toBeNull();
    });
  });
});
