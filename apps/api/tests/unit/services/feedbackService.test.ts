import {
  getLlmProvider,
  LlmError,
  type FormFeedbackDraft,
} from "../../../src/lib/llm";
import type { Logger } from "../../../src/lib/logger";
import feedbackService, {
  validateFormFeedback,
} from "../../../src/services/feedbackService";
import {
  createFakeLlmProvider,
  type FormFakeStep,
} from "../helpers/fakeLlmProvider";
import { makeScoredMetrics } from "../helpers/scoredMetrics";

vi.mock("../../../src/lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/llm")>()),
  getLlmProvider: vi.fn(),
}));

const context = {
  exerciseDisplayName: "Push-up",
  experienceLevel: "INTERMEDIATE",
  heightCm: 180,
  weightKg: 75,
} as const;

const usage = { inputTokens: 100, outputTokens: 50 };

const goodDraft = (
  overrides: Partial<FormFeedbackDraft> = {},
): FormFeedbackDraft => ({
  summary: "Nice set with a couple of things to tidy up.",
  positives: [{ text: "Your tempo stayed steady", repNumbers: [1, 2] }],
  corrections: [
    {
      errorTag: "PU_HIP_SAG",
      repNumbers: [5, 3, 3, 4],
      cue: "Squeeze your glutes",
      detail: "Your hips dropped on reps 3 to 5.",
    },
    {
      errorTag: "PU_SHALLOW_DEPTH",
      repNumbers: [4, 5],
      cue: "Go a little lower",
      detail: "Try bringing your chest closer to the floor.",
    },
  ],
  ...overrides,
});

const result = (feedback: FormFeedbackDraft): FormFakeStep => ({
  feedback,
  model: "claude-sonnet-5-5",
  usage,
});

const log = { warn: vi.fn() } as unknown as Logger;

const run = (
  steps: FormFakeStep[],
  overrides: {
    metrics?: ReturnType<typeof makeScoredMetrics>;
    timeoutMs?: number;
  } = {},
) => {
  const provider = createFakeLlmProvider([], steps);
  vi.mocked(getLlmProvider).mockReturnValue(provider);
  const signal = new AbortController().signal;
  const promise = feedbackService.generateFormFeedback({
    metrics: overrides.metrics ?? makeScoredMetrics(),
    context,
    signal,
    timeoutMs: overrides.timeoutMs ?? 20_000,
    log,
  });
  return { provider, promise, signal };
};

const lastIssues = (
  provider: ReturnType<typeof createFakeLlmProvider>,
): string => {
  const req = provider.generateFormFeedback.mock.calls.at(-1)?.[0];
  return req?.userPrompt ?? "";
};

describe("feedbackService.generateFormFeedback", () => {
  it("returns validated feedback merged with server finding data", async () => {
    const { provider, promise, signal } = run([result(goodDraft())]);

    const outcome = await promise;

    expect(outcome).toMatchObject({
      model: "claude-sonnet-5-5",
      promptVersion: "form-feedback-v1",
      usage,
      attempts: 1,
    });
    expect(outcome.feedback.corrections).toEqual([
      {
        tag: "PU_HIP_SAG",
        dimension: "CORE",
        severity: "MEDIUM",
        title: "Hips sagging",
        cue: "Squeeze your glutes",
        detail: "Your hips dropped on reps 3 to 5.",
        repNumbers: [3, 4, 5],
      },
      expect.objectContaining({
        tag: "PU_SHALLOW_DEPTH",
        title: "Shallow depth",
      }),
    ]);
    const req = provider.generateFormFeedback.mock.calls[0][0];
    expect(req.signal).toBe(signal);
    expect(req.allowedTags).toEqual(["PU_HIP_SAG", "PU_SHALLOW_DEPTH"]);
    expect(req.timeoutMs).toBeLessThanOrEqual(20_000);
    expect(req.maxTokens).toBe(1200);
  });

  it("repairs a draft with no positives", async () => {
    const { provider, promise } = run([
      result(goodDraft({ positives: [] })),
      result(goodDraft()),
    ]);

    const outcome = await promise;

    expect(outcome.attempts).toBe(2);
    expect(provider.generateFormFeedback).toHaveBeenCalledTimes(2);
    expect(lastIssues(provider)).toContain(
      "Include at least one positive observation",
    );
  });

  it.for([
    [
      "a rep outside the set",
      [7],
      "Rep numbers for PU_HIP_SAG must be among: 3, 4, 5",
    ],
    [
      "a rep not flagged for the tag",
      [1],
      "Rep numbers for PU_HIP_SAG must be among: 3, 4, 5",
    ],
  ] as const)("rejects %s", async ([, repNumbers, issue]) => {
    const draft = goodDraft();
    draft.corrections[0].repNumbers = [...repNumbers];
    const { provider, promise } = run([result(draft), result(draft)]);

    await expect(promise).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(provider.generateFormFeedback).toHaveBeenCalledTimes(2);
    expect(lastIssues(provider)).toContain(issue);
  });

  it("rejects a missing or unknown correction tag", async () => {
    const missing = goodDraft();
    missing.corrections.pop();
    const unknown = goodDraft();
    unknown.corrections[1].errorTag = "PU_MADE_UP";
    const { provider, promise } = run([result(missing), result(unknown)]);

    await expect(promise).rejects.toBeInstanceOf(LlmError);
    expect(lastIssues(provider)).toContain("PU_HIP_SAG, PU_SHALLOW_DEPTH");
  });

  it.for([
    ["degrees", "Bend to 90 degrees"],
    ["injury terms", "Do this to avoid injury"],
    ["forbidden topics", "Watch out for wrist pain"],
  ] as const)("rejects %s in the text", ([, text]) => {
    const draft = goodDraft();
    draft.corrections[0].detail = text;

    const validation = validateFormFeedback(draft, makeScoredMetrics());

    expect(validation.ok).toBe(false);
  });

  it("rejects over-long summary and cue", () => {
    const draft = goodDraft({ summary: "a".repeat(201) });
    draft.corrections[0].cue = "b".repeat(121);

    const validation = validateFormFeedback(draft, makeScoredMetrics());

    expect(validation).toMatchObject({
      ok: false,
      issues: [
        "The summary must be at most 200 characters",
        "The cue must be at most 120 characters",
      ],
    });
  });

  it("throws INVALID_OUTPUT after exactly two invalid drafts", async () => {
    const bad = goodDraft({ positives: [] });
    const { provider, promise } = run([result(bad), result(bad)]);

    await expect(promise).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(provider.generateFormFeedback).toHaveBeenCalledTimes(2);
  });

  it.for(["REFUSAL", "INVALID_OUTPUT"] as const)(
    "repairs with a generic issue after a provider %s",
    async (code) => {
      const { provider, promise } = run([
        new LlmError(code),
        result(goodDraft()),
      ]);

      await expect(promise).resolves.toMatchObject({ attempts: 2 });
      expect(lastIssues(provider)).toContain(
        "The previous response was not valid feedback",
      );
    },
  );

  it.for(["TIMEOUT", "RATE_LIMITED", "UNAVAILABLE"] as const)(
    "rethrows a provider %s immediately",
    async (code) => {
      const { provider, promise } = run([new LlmError(code)]);

      await expect(promise).rejects.toMatchObject({ code });
      expect(provider.generateFormFeedback).toHaveBeenCalledTimes(1);
    },
  );

  it("throws TIMEOUT without calling when under 1000 ms remain", async () => {
    const { provider, promise } = run([result(goodDraft())], {
      timeoutMs: 999,
    });

    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(provider.generateFormFeedback).not.toHaveBeenCalled();
  });

  it("throws TIMEOUT instead of repairing when the budget is spent", async () => {
    vi.useFakeTimers();
    try {
      const provider = createFakeLlmProvider(
        [],
        [result(goodDraft({ positives: [] }))],
      );
      provider.generateFormFeedback.mockImplementationOnce(() => {
        vi.advanceTimersByTime(1500);
        return Promise.resolve(result(goodDraft({ positives: [] })) as never);
      });
      vi.mocked(getLlmProvider).mockReturnValue(provider);

      await expect(
        feedbackService.generateFormFeedback({
          metrics: makeScoredMetrics(),
          context,
          signal: new AbortController().signal,
          timeoutMs: 2000,
          log,
        }),
      ).rejects.toMatchObject({ code: "TIMEOUT" });
      expect(provider.generateFormFeedback).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts empty corrections when the server selected none", async () => {
    const { provider, promise } = run(
      [result(goodDraft({ corrections: [] }))],
      { metrics: makeScoredMetrics({ corrections: [] }) },
    );

    const outcome = await promise;

    expect(outcome.feedback.corrections).toEqual([]);
    expect(provider.generateFormFeedback.mock.calls[0][0].allowedTags).toEqual(
      [],
    );
  });

  it("truncates positives beyond three instead of rejecting", async () => {
    const positives = [1, 2, 3, 4].map((n) => ({
      text: `Positive ${n}`,
      repNumbers: [],
    }));
    const { promise } = run([result(goodDraft({ positives }))]);

    const outcome = await promise;

    expect(outcome.attempts).toBe(1);
    expect(outcome.feedback.positives).toHaveLength(3);
  });
});
