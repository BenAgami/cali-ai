import {
  aggregateDimension,
  buildDimensions,
  computeOverall,
} from "../../../src/metrics/scoring";
import { getRubric } from "../../../src/metrics/rubrics";
import type { DimensionScore, RepMetrics } from "../../../src/metrics/types";

const dim = (score: number | null, isAssessed = true): DimensionScore => ({
  score,
  band: null,
  isAssessed,
});

const rep = (
  repNumber: number,
  dimensionScores: RepMetrics["dimensionScores"],
): RepMetrics => ({
  repNumber,
  startSec: 0,
  endSec: 1,
  durationSec: 1,
  features: {},
  dimensionScores,
  tags: [],
});

describe("aggregateDimension", () => {
  it("blends the mean (0.85) with the worst rep (0.15)", () => {
    expect(aggregateDimension([90, 80, 70])).toBe(79);
  });

  it("ignores NaN entries", () => {
    expect(aggregateDimension([90, Number.NaN, 90])).toBe(90);
  });

  it("returns null when nothing is valid", () => {
    expect(aggregateDimension([Number.NaN])).toBeNull();
    expect(aggregateDimension([])).toBeNull();
  });
});

describe("computeOverall", () => {
  it("renormalises over assessed dimensions", () => {
    expect(
      computeOverall(
        { ROM: dim(80), CORE: dim(60), SYMMETRY: dim(null, false) },
        { ROM: 0.5, CORE: 0.5, SYMMETRY: 0 },
      ),
    ).toBe(70);
  });

  it("applies the pull_up weights", () => {
    expect(
      computeOverall(
        { ROM: dim(90), CORE: dim(50), SYMMETRY: dim(80) },
        getRubric("pull_up").weights,
      ),
    ).toBe(82);
  });

  it("excludes an assessed dimension that has no score", () => {
    expect(
      computeOverall(
        { ROM: dim(80), CORE: dim(null), SYMMETRY: dim(null, false) },
        { ROM: 0.5, CORE: 0.5, SYMMETRY: 0 },
      ),
    ).toBe(80);
  });
});

describe("buildDimensions", () => {
  it("scores assessed dimensions and marks others unassessed", () => {
    const result = buildDimensions(
      [rep(1, { ROM: 100, CORE: 100 }), rep(2, { ROM: 100, CORE: 100 })],
      getRubric("push_up"),
    );
    expect(result.ROM).toEqual({
      score: 100,
      band: "EXCELLENT",
      isAssessed: true,
    });
    expect(result.SYMMETRY).toEqual({
      score: null,
      band: null,
      isAssessed: false,
    });
  });

  it("marks an assessed dimension with no valid rep score as unassessed", () => {
    const result = buildDimensions(
      [rep(1, { ROM: 70 }), rep(2, { ROM: 70 })],
      getRubric("push_up"),
    );
    expect(result.CORE).toEqual({ score: null, band: null, isAssessed: false });
    expect(result.ROM.band).toBe("FAIR");
  });
});
