export type Goal = {
  goalType: string;
  title: string;
  targetValue: number | null;
  targetUnit: string | null;
};

export type UserProfile = {
  uuid: string;
  username: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  experienceLevel: string;
  goals: Goal[];
};

export type GoalDraft = {
  goalType: string;
  title: string;
  targetValue: string;
  targetUnit: string;
};
