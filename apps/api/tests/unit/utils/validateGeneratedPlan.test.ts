import type { ExerciseSummary } from "@repo/common";

import type { WorkoutPlanDraft } from "../../../src/lib/llm";
import { validateGeneratedPlan } from "../../../src/utils/validateGeneratedPlan";

const entries: ExerciseSummary[] = [
  { id: 1, code: "push_up", displayName: "Push-up", exerciseType: "DYNAMIC" },
  { id: 2, code: "pull_up", displayName: "Pull-up", exerciseType: "DYNAMIC" },
  { id: 4, code: "plank", displayName: "Plank", exerciseType: "STATIC_HOLD" },
  { id: 5, code: "dip", displayName: "Dip", exerciseType: "DYNAMIC" },
];
const catalog = new Map(entries.map((e) => [e.code, e]));

const dynamicItem = (
  code: string,
  overrides: Record<string, unknown> = {},
) => ({
  exerciseCode: code,
  sets: 3,
  reps: 10,
  durationSecs: null,
  restSecs: 60,
  ...overrides,
});

const holdItem = (overrides: Record<string, unknown> = {}) => ({
  exerciseCode: "plank",
  sets: 3,
  reps: null,
  durationSecs: 30,
  restSecs: 60,
  ...overrides,
});

const draft = (
  exercises: WorkoutPlanDraft["exercises"] = [
    dynamicItem("push_up"),
    dynamicItem("pull_up"),
    holdItem(),
  ],
  overrides: Partial<WorkoutPlanDraft> = {},
): WorkoutPlanDraft => ({
  name: "  Upper body  ",
  note: null,
  exercises,
  ...overrides,
});

const issuesOf = (
  draft: WorkoutPlanDraft,
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" = "BEGINNER",
) => {
  const result = validateGeneratedPlan(draft, catalog, level);
  if (result.isValid) throw new Error("expected invalid plan");
  return result.issues;
};

describe("validateGeneratedPlan", () => {
  it("accepts a valid plan, trims the name and hydrates exercises", () => {
    const result = validateGeneratedPlan(draft(), catalog, "BEGINNER");

    expect(result).toEqual({
      isValid: true,
      plan: {
        name: "Upper body",
        note: null,
        exercises: [
          {
            exerciseId: 1,
            sets: 3,
            reps: 10,
            durationSecs: null,
            restSecs: 60,
            exercise: entries[0],
          },
          expect.objectContaining({ exerciseId: 2, exercise: entries[1] }),
          expect.objectContaining({ exerciseId: 4, exercise: entries[2] }),
        ],
      },
    });
  });

  it("matches codes after trim and lowercase", () => {
    const result = validateGeneratedPlan(
      draft([dynamicItem("Push_Up "), dynamicItem("pull_up"), holdItem()]),
      catalog,
      "BEGINNER",
    );
    expect(result.isValid).toBe(true);
  });

  it("rejects unknown codes", () => {
    expect(
      issuesOf(
        draft([dynamicItem("handstand"), dynamicItem("pull_up"), holdItem()]),
      ),
    ).toContain("Unknown exercise code: handstand");
  });

  it.each([2, 7])("rejects %i exercises", (count) => {
    const exercises = Array.from({ length: count }, () =>
      dynamicItem("push_up"),
    );
    expect(issuesOf(draft(exercises))).toContain(
      "Plan must have 3 to 6 exercises",
    );
  });

  it("rejects a DYNAMIC exercise with a duration instead of reps", () => {
    const issues = issuesOf(
      draft([
        dynamicItem("push_up", { reps: null, durationSecs: 30 }),
        dynamicItem("pull_up"),
        holdItem(),
      ]),
    );
    expect(issues).toEqual([expect.stringMatching(/push_up.*reps/)]);
  });

  it("rejects a STATIC_HOLD exercise with reps", () => {
    const issues = issuesOf(
      draft([
        dynamicItem("push_up"),
        dynamicItem("pull_up"),
        holdItem({ reps: 5, durationSecs: null }),
      ]),
    );
    expect(issues).toEqual([expect.stringMatching(/plank.*durationSecs/)]);
  });

  it.each([
    ["sets 5", { sets: 5 }],
    ["reps 20", { reps: 20 }],
  ])("applies beginner bounds (%s)", (_label, override) => {
    const d = draft([
      dynamicItem("push_up", override),
      dynamicItem("pull_up"),
      holdItem(),
    ]);
    expect(issuesOf(d, "BEGINNER")).toHaveLength(1);
    expect(validateGeneratedPlan(d, catalog, "ADVANCED").isValid).toBe(true);
  });

  it.each([
    ["restSecs 10", dynamicItem("push_up", { restSecs: 10 })],
    ["restSecs 400", dynamicItem("push_up", { restSecs: 400 })],
    ["sets 0", dynamicItem("push_up", { sets: 0 })],
    ["sets 7", dynamicItem("push_up", { sets: 7 })],
    ["reps 31", dynamicItem("push_up", { reps: 31 })],
  ])("rejects out-of-range %s for any level", (_label, exercise) => {
    const d = draft([exercise, dynamicItem("pull_up"), holdItem()]);
    expect(issuesOf(d, "ADVANCED")).toHaveLength(1);
  });

  it("rejects hold durations outside 5-120", () => {
    const d = draft([
      dynamicItem("push_up"),
      dynamicItem("pull_up"),
      holdItem({ durationSecs: 600 }),
    ]);
    expect(issuesOf(d, "ADVANCED")).toEqual([
      expect.stringContaining("durationSecs"),
    ]);
  });

  it("collects all issues rather than stopping at the first", () => {
    const issues = issuesOf(
      draft([
        dynamicItem("handstand"),
        dynamicItem("push_up", { restSecs: 5 }),
      ]),
    );
    expect(issues).toHaveLength(3);
  });

  it("rejects an empty name", () => {
    expect(issuesOf(draft(undefined, { name: "   " }))).toContain(
      "Plan name is empty",
    );
  });

  it("truncates long names and notes without raising issues", () => {
    const result = validateGeneratedPlan(
      draft(undefined, { name: "n".repeat(150), note: "x".repeat(400) }),
      catalog,
      "BEGINNER",
    );
    if (!result.isValid) throw new Error("expected valid plan");
    expect(result.plan.name).toHaveLength(100);
    expect(result.plan.note).toHaveLength(300);
  });
});
