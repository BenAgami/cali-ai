import { dipRubric } from "../../../../src/metrics/rubrics/dip";
import { runRubric, tagLabels } from "../../helpers/rubricRun";

const BASE = { reps: 5, view: "side" as const, aspectRatio: 16 / 9 };

describe("dip rubric", () => {
  it("is side-on: SYMMETRY not assessed", () => {
    expect(dipRubric.exerciseCode).toBe("dip");
    expect(dipRubric.assessed.SYMMETRY).toBe(false);
    expect(dipRubric.weights).toEqual({ ROM: 0.5, CORE: 0.5, SYMMETRY: 0 });
    expect(dipRubric.forbiddenTopics).toEqual(
      expect.arrayContaining(["shoulder shrug", "bar width", "injury"]),
    );
  });

  it("recovers elbow range and trunk lean, with no tags for a clean set", () => {
    const run = runRubric(dipRubric, {
      ...BASE,
      depthDeg: 90,
      lockoutDeg: 170,
      trunkLeanDeg: 20,
    });
    expect(run.features).toHaveLength(5);
    for (const f of run.features) {
      expect(Math.abs(f.minElbowDeg - 90)).toBeLessThanOrEqual(3);
      expect(Math.abs(f.maxElbowDeg - 170)).toBeLessThanOrEqual(3);
      expect(Math.abs(f.trunkLeanDeg - 20)).toBeLessThanOrEqual(3);
      expect(f.hipSwayRatio).toBeLessThan(0.05);
    }
    expect(tagLabels(run).flat()).toEqual([]);
  });

  it("recovers hip sway as peak-to-peak (twice the amplitude)", () => {
    const run = runRubric(dipRubric, {
      ...BASE,
      trunkLeanDeg: 20,
      hipSwayRatio: 0.3,
    });
    expect(run.features).toHaveLength(5);
    for (const f of run.features)
      expect(Math.abs(f.hipSwayRatio - 0.6)).toBeLessThanOrEqual(0.03);
  });

  it.each([
    [{ depthDeg: 115 }, "DIP_SHALLOW_DEPTH:MEDIUM"],
    [{ depthDeg: 130, lockoutDeg: 175 }, "DIP_SHALLOW_DEPTH:HIGH"],
    [{ depthDeg: 60 }, "DIP_EXCESSIVE_DEPTH:LOW"],
    [{ lockoutDeg: 150 }, "DIP_INCOMPLETE_LOCKOUT:MEDIUM"],
    [{ trunkLeanDeg: 50 }, "DIP_EXCESSIVE_LEAN:MEDIUM"],
    [{ hipSwayRatio: 0.3 }, "DIP_SWING:MEDIUM"],
  ])("tags %j", (options, expected) => {
    const run = runRubric(dipRubric, { ...BASE, trunkLeanDeg: 20, ...options });
    expect(run.features).toHaveLength(5);
    for (const rep of tagLabels(run)) expect(rep).toContain(expected);
  });

  it("never escalates DIP_EXCESSIVE_DEPTH past LOW", () => {
    const rule = dipRubric.repTags.find((r) => r.tag === "DIP_EXCESSIVE_DEPTH");
    for (const minElbowDeg of [69, 40, 10, 0]) {
      expect(rule?.evaluate({ minElbowDeg })).toBe("LOW");
    }
    expect(rule?.evaluate({ minElbowDeg: 70 })).toBeNull();
  });
});
