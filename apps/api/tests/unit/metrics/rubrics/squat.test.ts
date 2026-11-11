import { getRubric } from "../../../../src/metrics/rubrics";
import { squatRubric } from "../../../../src/metrics/rubrics/squat";
import type { RepMetrics } from "../../../../src/metrics/types";
import { runRubric, tagLabels } from "../../helpers/rubricRun";

const BASE = { reps: 5, view: "side" as const };

const repsWith = (hipBelowKnee: number[]): RepMetrics[] =>
  hipBelowKnee.map((value, index) => ({
    repNumber: index + 1,
    startSec: index * 2,
    endSec: index * 2 + 1.5,
    durationSec: 1.5,
    features: { hipBelowKnee: value },
    dimensionScores: {},
    tags: [],
  }));

describe("squat rubric", () => {
  it("is side-on: SYMMETRY not assessed", () => {
    expect(getRubric("squat")).toBe(squatRubric);
    expect(squatRubric.assessed).toEqual({
      ROM: true,
      CORE: true,
      SYMMETRY: false,
    });
    expect(squatRubric.weights).toEqual({ ROM: 0.5, CORE: 0.5, SYMMETRY: 0 });
    expect(squatRubric.forbiddenTopics).toEqual(
      expect.arrayContaining(["knees caving in", "knees past toes", "pain"]),
    );
  });

  it("recovers depth, lean and heel features with no tags for a clean set", () => {
    const run = runRubric(squatRubric, {
      ...BASE,
      depthDeg: 85,
      lockoutDeg: 175,
      trunkLeanDeg: 20,
    });
    expect(run.features).toHaveLength(5);
    for (const f of run.features) {
      expect(Math.abs(f.minKneeDeg - 85)).toBeLessThanOrEqual(3);
      expect(Math.abs(f.maxKneeDeg - 175)).toBeLessThanOrEqual(3);
      expect(f.hipBelowKnee).toBeGreaterThanOrEqual(-0.03);
      expect(Math.abs(f.trunkLeanDeg - 20)).toBeLessThanOrEqual(3);
      expect(f.heelRiseDeg).toBeLessThanOrEqual(1);
    }
    expect(tagLabels(run).flat()).toEqual([]);
    for (const s of run.scores) expect(s.ROM).toBeGreaterThanOrEqual(90);
  });

  it("recovers heel rise against the first-second baseline", () => {
    const run = runRubric(squatRubric, { ...BASE, heelRiseDeg: 12 });
    expect(run.features).toHaveLength(5);
    for (const f of run.features)
      expect(Math.abs(f.heelRiseDeg - 12)).toBeLessThanOrEqual(3);
  });

  it("tags shallow depth, HIGH when well above parallel", () => {
    const medium = runRubric(squatRubric, { ...BASE, depthDeg: 95 });
    expect(medium.features).toHaveLength(5);
    for (const f of medium.features) {
      expect(f.hipBelowKnee).toBeLessThan(-0.05);
      expect(f.hipBelowKnee).toBeGreaterThan(-0.2);
    }
    for (const rep of tagLabels(medium))
      expect(rep).toContain("SQ_SHALLOW_DEPTH:MEDIUM");
    const high = runRubric(squatRubric, {
      ...BASE,
      depthDeg: 120,
      lockoutDeg: 175,
    });
    expect(high.features).toHaveLength(5);
    for (const f of high.features) expect(f.hipBelowKnee).toBeLessThan(-0.2);
    for (const rep of tagLabels(high))
      expect(rep).toContain("SQ_SHALLOW_DEPTH:HIGH");
  });

  it("scores a shallow squat clearly below a parallel one (calibration)", () => {
    const base = { maxKneeDeg: 180, minKneeDeg: 80 };
    const parallel = squatRubric.scoreRep({ ...base, hipBelowKnee: 0 });
    const shallow = squatRubric.scoreRep({ ...base, hipBelowKnee: -0.1 });
    const veryShallow = squatRubric.scoreRep({ ...base, hipBelowKnee: -0.2 });
    expect(parallel.ROM).toBe(100);
    expect(shallow.ROM).toBeLessThan(75);
    expect(veryShallow.ROM).toBeLessThanOrEqual(50);
  });

  it("also flags a knee angle above 110 even when the hip height is borderline", () => {
    const rule = squatRubric.repTags.find((r) => r.tag === "SQ_SHALLOW_DEPTH");
    expect(rule?.evaluate({ hipBelowKnee: 0, minKneeDeg: 115 })).toBe("MEDIUM");
    expect(rule?.evaluate({ hipBelowKnee: 0.02, minKneeDeg: 90 })).toBeNull();
    expect(rule?.evaluate({ hipBelowKnee: -0.25, minKneeDeg: 90 })).toBe(
      "HIGH",
    );
  });

  it("tags excessive trunk lean as MEDIUM, never HIGH", () => {
    const run = runRubric(squatRubric, { ...BASE, trunkLeanDeg: 65 });
    expect(run.features).toHaveLength(5);
    for (const rep of tagLabels(run)) {
      expect(rep).toContain("SQ_EXCESSIVE_TRUNK_LEAN:MEDIUM");
      expect(rep).not.toContain("SQ_EXCESSIVE_TRUNK_LEAN:HIGH");
    }
    const rule = squatRubric.repTags.find(
      (r) => r.tag === "SQ_EXCESSIVE_TRUNK_LEAN",
    );
    expect(rule?.evaluate({ trunkLeanDeg: 120, shinLeanDeg: 0 })).toBe(
      "MEDIUM",
    );
  });

  it("tags heel rise", () => {
    const run = runRubric(squatRubric, { ...BASE, heelRiseDeg: 12 });
    for (const rep of tagLabels(run))
      expect(rep).toContain("SQ_HEEL_RISE:MEDIUM");
  });

  it("tags an incomplete stand and rushed tempo as LOW", () => {
    const stand = runRubric(squatRubric, { ...BASE, lockoutDeg: 150 });
    expect(stand.features).toHaveLength(5);
    for (const rep of tagLabels(stand))
      expect(rep).toContain("SQ_INCOMPLETE_STAND:LOW");
    const rushed = runRubric(squatRubric, { ...BASE, repSec: 1.2 });
    expect(rushed.features.length).toBeGreaterThanOrEqual(4);
    for (const rep of tagLabels(rushed))
      expect(rep).toContain("SQ_RUSHED_TEMPO:LOW");
  });

  it("falls back to hip height when the near knee is unreliable", () => {
    const run = runRubric(squatRubric, BASE, (payload) => {
      for (const frame of payload.frames) frame.keypoints[25][2] = 0.4;
    });
    expect(run.segmentation.reps).toHaveLength(5);
  });

  describe("FATIGUE_DROP", () => {
    const [rule] = squatRubric.setTags;

    it("fires when the last 2 reps sit higher than the first 2", () => {
      expect(
        rule.evaluate(repsWith([0.1, 0.1, 0.05, 0.05, -0.05, -0.05])),
      ).toEqual({ severity: "MEDIUM", repNumbers: [5, 6] });
    });

    it("needs at least 4 reps and a drop over 0.10", () => {
      expect(rule.evaluate(repsWith([0.1, 0, -0.1]))).toBeNull();
      expect(
        rule.evaluate(repsWith([0.1, 0.1, 0.05, 0.05, 0.05, 0.05])),
      ).toBeNull();
    });
  });
});
