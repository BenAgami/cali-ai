import {
  angleAt,
  angleFromVertical,
  hipOffsetRatio,
  median,
  percentile,
  ramp,
  std,
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
});

describe("angleFromVertical", () => {
  it("is 0 for a vertical segment and 90 for a horizontal one", () => {
    expect(angleFromVertical([0, 1], [0, 0])).toBeCloseTo(0, 6);
    expect(angleFromVertical([0, 0], [1, 0])).toBeCloseTo(90, 6);
  });
});

describe("ramp", () => {
  it("interpolates when good < poor", () => {
    expect(ramp(90, 90, 130)).toBe(100);
    expect(ramp(110, 90, 130)).toBe(50);
    expect(ramp(140, 90, 130)).toBe(0);
  });

  it("interpolates when good > poor", () => {
    expect(ramp(170, 165, 140)).toBe(100);
    expect(ramp(152.5, 165, 140)).toBe(50);
  });

  it("propagates NaN", () => {
    expect(ramp(Number.NaN, 90, 130)).toBeNaN();
  });
});

describe("statistics", () => {
  it("computes median, percentile and std", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(percentile([0, 10], 25)).toBe(2.5);
    expect(std([2, 2, 2])).toBe(0);
    expect(median([])).toBeNaN();
  });
});
