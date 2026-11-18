import {
  angleAt,
  angleFromVertical,
  hipOffsetRatio,
  median,
  percentile,
  linearScore,
  standardDeviation,
} from "../../../src/metrics/geometry";

describe("angleAt", () => {
  it("measures a right angle", () => {
    expect(angleAt([1, 0], [0, 0], [0, 1])).toBeCloseTo(90, 6);
  });

  it("measures a straight line as 180", () => {
    expect(angleAt([-1, 0], [0, 0], [1, 0])).toBeCloseTo(180, 6);
  });

  it("returns NaN for coincident points", () => {
    expect(angleAt([0, 0], [0, 0], [0, 1])).toBeNaN();
  });
});

describe("hipOffsetRatio", () => {
  it("is positive when the hip sags below the line, facing right", () => {
    expect(hipOffsetRatio([0, 0], [0.5, 0.1], [1, 0])).toBeCloseTo(0.1, 6);
  });

  it("is positive when the hip sags below the line, facing left", () => {
    expect(hipOffsetRatio([1, 0], [0.5, 0.1], [0, 0])).toBeCloseTo(0.1, 6);
  });

  it("is negative when the hip is above the line", () => {
    expect(hipOffsetRatio([0, 0], [0.5, -0.1], [1, 0])).toBeCloseTo(-0.1, 6);
    expect(hipOffsetRatio([1, 0], [0.5, -0.1], [0, 0])).toBeCloseTo(-0.1, 6);
  });

  it("returns NaN when shoulder and ankle coincide", () => {
    expect(hipOffsetRatio([0, 0], [0.5, 0.1], [0, 0])).toBeNaN();
  });

  it("divides by the shoulder-ankle length", () => {
    expect(hipOffsetRatio([0, 0], [1, 0.2], [2, 0])).toBeCloseTo(0.1, 6);
  });
});

describe("angleFromVertical", () => {
  it("is 0 for a vertical segment and 90 for a horizontal one", () => {
    expect(angleFromVertical([0, 1], [0, 0])).toBeCloseTo(0, 6);
    expect(angleFromVertical([0, 0], [1, 0])).toBeCloseTo(90, 6);
  });

  it("is 180 for a segment pointing straight down", () => {
    expect(angleFromVertical([0, 0], [0, 1])).toBeCloseTo(180, 6);
  });

  it("is 45 for a diagonal leaning either way", () => {
    expect(angleFromVertical([0, 1], [1, 0])).toBeCloseTo(45, 6);
    expect(angleFromVertical([1, 1], [0, 0])).toBeCloseTo(45, 6);
  });

  it("returns NaN for coincident points", () => {
    expect(angleFromVertical([0, 0], [0, 0])).toBeNaN();
  });
});

describe("linearScore", () => {
  it("interpolates when good < poor", () => {
    expect(linearScore(90, 90, 130)).toBe(100);
    expect(linearScore(110, 90, 130)).toBe(50);
    expect(linearScore(140, 90, 130)).toBe(0);
  });

  it("interpolates when good > poor", () => {
    expect(linearScore(170, 165, 140)).toBe(100);
    expect(linearScore(152.5, 165, 140)).toBe(50);
  });

  it("propagates NaN", () => {
    expect(linearScore(Number.NaN, 90, 130)).toBeNaN();
  });
});

describe("statistics", () => {
  it("computes median, percentile and standardDeviation", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(percentile([0, 10], 25)).toBe(2.5);
    expect(standardDeviation([2, 2, 2])).toBe(0);
    expect(median([])).toBeNaN();
  });

  it("computes the population standard deviation (divides by n)", () => {
    expect(standardDeviation([80, 100, 85, 115])).toBeCloseTo(
      Math.sqrt(187.5),
      6,
    );
  });
});
