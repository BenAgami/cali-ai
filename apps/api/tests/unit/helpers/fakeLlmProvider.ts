import type { LlmError } from "../../../src/lib/llm";
import type {
  FormFeedbackRequest,
  FormFeedbackResult,
  WorkoutPlanRequest,
  WorkoutPlanResult,
} from "../../../src/lib/llm/types";

export type FakeStep = WorkoutPlanResult | LlmError | Error;
export type FormFakeStep = FormFeedbackResult | LlmError | Error;

const nextStep = <T>(queue: (T | Error)[]) => {
  const next = queue.shift();
  if (!next) return Promise.reject(new Error("fake provider exhausted"));
  return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
};

export const createFakeLlmProvider = (
  steps: FakeStep[],
  formSteps: FormFakeStep[] = [],
) => {
  const queue = [...steps];
  const formQueue = [...formSteps];
  const generateWorkoutPlan = vi.fn((_req: WorkoutPlanRequest) =>
    nextStep<WorkoutPlanResult>(queue),
  );
  const generateFormFeedback = vi.fn((_req: FormFeedbackRequest) =>
    nextStep<FormFeedbackResult>(formQueue),
  );
  return { generateWorkoutPlan, generateFormFeedback };
};
