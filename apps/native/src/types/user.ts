import type { GoalType } from "@repo/common";

export type GoalDraft = {
  goalType: GoalType;
  title: string;
  targetValue: string;
  targetUnit: string;
};
