import {
  buildWorkoutPlanPrompt,
  WORKOUT_PLAN_PROMPT_VERSION,
  type WorkoutPlanPromptInput,
} from "../../../src/prompts/workoutPlanPrompt";

const makeInput = (
  overrides: Partial<WorkoutPlanPromptInput> = {},
): WorkoutPlanPromptInput => ({
  experienceLevel: "INTERMEDIATE",
  goal: { goalType: "SKILL", title: "Do a muscle-up" },
  heightCm: 180,
  weightKg: 75,
  goalText: "SECRET-GOAL-TEXT build upper body strength",
  catalog: [
    { code: "push-up", displayName: "Push-up", exerciseType: "DYNAMIC" },
    { code: "plank", displayName: "Plank", exerciseType: "STATIC_HOLD" },
  ],
  ...overrides,
});

describe("buildWorkoutPlanPrompt", () => {
  it("exposes the prompt version", () => {
    expect(WORKOUT_PLAN_PROMPT_VERSION).toBe("workout-plan-v1");
  });

  it("lists every catalog entry in the system prompt", () => {
    const { system } = buildWorkoutPlanPrompt(makeInput());

    expect(system).toContain("push-up | Push-up | DYNAMIC");
    expect(system).toContain("plank | Plank | STATIC_HOLD");
    expect(system).toContain("Use only these codes");
  });

  it("includes the level rules and exercise count", () => {
    const { system } = buildWorkoutPlanPrompt(makeInput());

    expect(system).toContain("3 to 6 exercises");
    expect(system).toContain("BEGINNER: sets 2-3");
    expect(system).toContain("ADVANCED: sets 3-5");
  });

  it("keeps goal text out of the system prompt", () => {
    const { system } = buildWorkoutPlanPrompt(makeInput());

    expect(system).not.toContain("SECRET-GOAL-TEXT");
  });

  it("carries profile context and wrapped goal text in the user turn", () => {
    const { userPrompt } = buildWorkoutPlanPrompt(makeInput());

    expect(userPrompt).toContain(
      "<goal>SECRET-GOAL-TEXT build upper body strength</goal>",
    );
    expect(userPrompt).toContain("INTERMEDIATE");
    expect(userPrompt).toContain("Do a muscle-up");
    expect(userPrompt).toContain("SKILL");
    expect(userPrompt).toContain("Height: 180 cm");
    expect(userPrompt).toContain("Weight: 75 kg");
  });

  it("adds retry feedback only when previous issues are given", () => {
    const withIssues = buildWorkoutPlanPrompt(
      makeInput({ previousIssues: ["Unknown exercise code: handstand"] }),
    );
    const without = buildWorkoutPlanPrompt(makeInput());
    const empty = buildWorkoutPlanPrompt(makeInput({ previousIssues: [] }));

    expect(withIssues.userPrompt).toContain("Your previous plan was rejected");
    expect(withIssues.userPrompt).toContain(
      "- Unknown exercise code: handstand",
    );
    expect(without.userPrompt).not.toContain("Your previous plan was rejected");
    expect(empty.userPrompt).not.toContain("Your previous plan was rejected");
  });
});
