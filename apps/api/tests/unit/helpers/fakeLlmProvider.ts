import type { LlmError } from "../../../src/lib/llm";
import type {
  WorkoutPlanRequest,
  WorkoutPlanResult,
} from "../../../src/lib/llm/types";

export type FakeStep = WorkoutPlanResult | LlmError | Error;

export const createFakeLlmProvider = (steps: FakeStep[]) => {
  const queue = [...steps];
  const generateWorkoutPlan = vi.fn((_req: WorkoutPlanRequest) => {
    const next = queue.shift();
    if (!next) return Promise.reject(new Error("fake provider exhausted"));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { generateWorkoutPlan };
};
