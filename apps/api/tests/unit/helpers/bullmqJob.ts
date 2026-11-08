import type { Job } from "bullmq";

export const createFakeJob = <T>(overrides: {
  id?: string;
  data: T;
  attemptsMade?: number;
  attempts?: number;
}): Job<T> =>
  ({
    id: overrides.id ?? "analysis-test",
    data: overrides.data,
    attemptsMade: overrides.attemptsMade ?? 0,
    opts: { attempts: overrides.attempts ?? 3 },
  }) as unknown as Job<T>;
