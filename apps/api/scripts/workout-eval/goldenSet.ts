import type { GoalType } from "@repo/common";

import type { CatalogExercise } from "../../src/utils/validateGeneratedPlan";

export const EVAL_CATALOG: CatalogExercise[] = [
  { id: 1, code: "push_up", displayName: "Push Up", exerciseType: "DYNAMIC" },
  { id: 2, code: "pull_up", displayName: "Pull Up", exerciseType: "DYNAMIC" },
  { id: 3, code: "squat", displayName: "Squat", exerciseType: "DYNAMIC" },
  {
    id: 4,
    code: "plank",
    displayName: "Plank",
    exerciseType: "STATIC_HOLD",
  },
  { id: 5, code: "dip", displayName: "Dip", exerciseType: "DYNAMIC" },
];

export const EVAL_GOALS = [
  "Build upper-body strength",
  "Get my first pull-up",
  "20-minute full-body routine",
  "Improve push-up endurance",
  "Learn to hold a handstand",
  "My knee hurts but I want to train legs",
] as const;

/** Goals whose plan must carry a note (missing exercise / injury). */
export const EVAL_NOTE_GOALS: ReadonlySet<string> = new Set([
  "Learn to hold a handstand",
  "My knee hurts but I want to train legs",
]);

export const EVAL_LEVELS = ["BEGINNER", "ADVANCED"] as const;

export const EVAL_PROFILE: {
  goal: { goalType: GoalType; title: string };
  heightCm: number;
  weightKg: number;
} = {
  goal: { goalType: "STRENGTH", title: "Get stronger" },
  heightCm: 175,
  weightKg: 72,
};
