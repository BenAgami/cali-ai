import { getRubric } from "../../../src/metrics/rubrics";
import type { ExerciseRubric } from "../../../src/metrics/rubrics/types";
import {
  buildPositives,
  detectFindings,
  selectCorrections,
} from "../../../src/metrics/selectFindings";
import type {
  DetectedFinding,
  DimensionScore,
  FindingSeverity,
  RepMetrics,
} from "../../../src/metrics/types";

const rep = (
  repNumber: number,
  overrides: Partial<RepMetrics> = {},
): RepMetrics => ({
  repNumber,
  startSec: repNumber * 2,
  endSec: repNumber * 2 + 1.5,
  durationSec: 1.5,
  features: { minElbowDeg: 90 },
  dimensionScores: {},
  tags: [],
  ...overrides,
});

const reps = (
  count: number,
  tagsByRep: Record<number, [string, FindingSeverity][]> = {},
) =>
  Array.from({ length: count }, (_, i) =>
    rep(i + 1, {
      tags: (tagsByRep[i + 1] ?? []).map(([tag, severity]) => ({
        tag,
        severity,
      })),
    }),
  );

const finding = (
  tag: string,
  dimension: DetectedFinding["dimension"],
  severity: FindingSeverity,
  affectedFraction: number,
): DetectedFinding => ({
  tag,
  dimension,
  severity,
  label: tag,
  cue: tag,
  repNumbers: [1],
  affectedFraction,
});

const pushUp = getRubric("push_up");

describe("detectFindings", () => {
  it("detects a tag on 2 of 5 reps (40%)", () => {
    const found = detectFindings(
      reps(5, { 1: [["PU_HIP_SAG", "LOW"]], 2: [["PU_HIP_SAG", "HIGH"]] }),
      pushUp,
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      tag: "PU_HIP_SAG",
      dimension: "CORE",
      severity: "HIGH",
      repNumbers: [1, 2],
      affectedFraction: 0.4,
    });
    expect(found[0].label).toBeTruthy();
    expect(found[0].cue).toBeTruthy();
  });

  it("does not detect a tag on 1 of 5 reps", () => {
    expect(
      detectFindings(reps(5, { 3: [["PU_HIP_SAG", "HIGH"]] }), pushUp),
    ).toEqual([]);
  });

  it("detects a single-rep tag on a 2-rep set", () => {
    expect(
      detectFindings(reps(2, { 2: [["PU_HIP_SAG", "LOW"]] }), pushUp),
    ).toHaveLength(1);
  });

  it("includes FATIGUE_DROP with its rep numbers", () => {
    const set = [90, 90, 100, 120].map((minElbowDeg, i) =>
      rep(i + 1, { features: { minElbowDeg } }),
    );
    const found = detectFindings(set, pushUp);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      tag: "FATIGUE_DROP",
      dimension: "ROM",
      severity: "MEDIUM",
      repNumbers: [3, 4],
    });
  });

  it("returns [] when nothing is detected", () => {
    expect(detectFindings(reps(5), pushUp)).toEqual([]);
  });
});

describe("selectCorrections", () => {
  it("skips the second ROM tag when CORE has one", () => {
    const selected = selectCorrections([
      finding("ROM_A", "ROM", "HIGH", 0.6),
      finding("ROM_B", "ROM", "MEDIUM", 1.0),
      finding("CORE_A", "CORE", "MEDIUM", 0.4),
    ]);
    expect(selected.map((f) => f.tag)).toEqual(["ROM_B", "CORE_A"]);
  });

  it("keeps the top 2 when only one dimension has issues", () => {
    const selected = selectCorrections([
      finding("C", "ROM", "LOW", 0.6),
      finding("A", "ROM", "MEDIUM", 1.0),
      finding("B", "ROM", "MEDIUM", 0.6),
    ]);
    expect(selected.map((f) => f.tag)).toEqual(["A", "B"]);
  });

  it("breaks ties by dimension order then tag code", () => {
    const selected = selectCorrections([
      finding("B_TAG", "CORE", "MEDIUM", 0.5),
      finding("Z_TAG", "ROM", "MEDIUM", 0.5),
      finding("A_TAG", "ROM", "MEDIUM", 0.5),
    ]);
    expect(selected.map((f) => f.tag)).toEqual(["A_TAG", "B_TAG"]);
  });

  it("returns [] for no findings", () => {
    expect(selectCorrections([])).toEqual([]);
  });
});

describe("buildPositives", () => {
  const dims = (
    rom: DimensionScore["band"],
    core: DimensionScore["band"],
  ): Record<"ROM" | "CORE" | "SYMMETRY", DimensionScore> => ({
    ROM: { score: 80, band: rom, isAssessed: true },
    CORE: { score: 80, band: core, isAssessed: true },
    SYMMETRY: { score: null, band: null, isAssessed: false },
  });

  it("lists good dimensions then features, capped at 2, fallback last", () => {
    const positives = buildPositives(
      reps(5),
      dims("GOOD", "EXCELLENT"),
      pushUp,
    );
    expect(positives.map((p) => p.kind)).toEqual([
      "DIMENSION_GOOD",
      "DIMENSION_GOOD",
      "COMPLETED_REPS",
    ]);
    expect(positives[0].text).toBe(
      "Your range of motion was good across the set.",
    );
    expect(positives[2].text).toBe("You finished 5 reps.");
    expect(positives[2].repNumbers).toEqual([1, 2, 3, 4, 5]);
  });

  it("adds FULL_RANGE, CONSISTENT_DEPTH and STEADY_TEMPO when earned", () => {
    const positives = buildPositives(reps(5), dims("FAIR", "POOR"), pushUp);
    expect(positives.map((p) => p.kind)).toEqual([
      "FULL_RANGE",
      "CONSISTENT_DEPTH",
      "COMPLETED_REPS",
    ]);
  });

  it("skips FULL_RANGE when a lockout tag fired", () => {
    const set = reps(5, { 2: [["PU_INCOMPLETE_LOCKOUT", "LOW"]] });
    const kinds = buildPositives(set, dims("FAIR", "POOR"), pushUp).map(
      (p) => p.kind,
    );
    expect(kinds).not.toContain("FULL_RANGE");
    expect(kinds).toContain("CONSISTENT_DEPTH");
  });

  it("skips CONSISTENT_DEPTH and STEADY_TEMPO when erratic or rushed", () => {
    const set = [70, 90, 110, 130, 100].map((minElbowDeg, i) =>
      rep(i + 1, {
        features: { minElbowDeg },
        durationSec: i === 0 ? 0.5 : 2,
        tags: [{ tag: "PU_INCOMPLETE_LOCKOUT", severity: "LOW" }],
      }),
    );
    expect(
      buildPositives(set, dims("FAIR", "POOR"), pushUp).map((p) => p.kind),
    ).toEqual(["COMPLETED_REPS"]);
  });

  it("awards STEADY_TEMPO only for low duration variation and no rushed tag", () => {
    const rubric: ExerciseRubric = {
      ...pushUp,
      positives: { ...pushUp.positives, fullRangeTags: ["X"], depthStdMax: 0 },
    };
    const steady = [1.5, 1.6, 1.4].map((durationSec, i) =>
      rep(i + 1, { durationSec, tags: [{ tag: "X", severity: "LOW" }] }),
    );
    expect(
      buildPositives(steady, dims("FAIR", "POOR"), rubric).map((p) => p.kind),
    ).toEqual(["STEADY_TEMPO", "COMPLETED_REPS"]);
  });

  it("returns exactly the fallback for an all-Poor set", () => {
    const set = reps(3).map((r, i) => ({
      ...r,
      features: { minElbowDeg: 60 + i * 40 },
      tags: [{ tag: "PU_INCOMPLETE_LOCKOUT", severity: "LOW" as const }],
      durationSec: i === 0 ? 0.4 : 3,
    }));
    const positives = buildPositives(set, dims("POOR", "POOR"), pushUp);
    expect(positives).toHaveLength(1);
    expect(positives[0].kind).toBe("COMPLETED_REPS");
  });
});
