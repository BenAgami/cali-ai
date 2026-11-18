import {
  getLlmProvider,
  LlmError,
  type FormFeedbackDraft,
} from "../../../src/lib/llm";
import { env } from "../../../src/config/env";
import type { Logger } from "../../../src/lib/logger";
import feedbackService, {
  validateFormFeedback,
} from "../../../src/services/feedbackService";
import {
  createFakeLlmProvider,
  type FormFakeStep,
} from "../helpers/fakeLlmProvider";
import { COMMON_FORBIDDEN_TOPICS } from "../../../src/metrics/rubrics/shared";
import { makeScoredMetrics } from "../helpers/scoredMetrics";
import { FORM_FEEDBACK_PROMPT_VERSION } from "../../../src/prompts/formFeedbackPrompt";

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
  overrides: { metrics?: ReturnType<typeof makeScoredMetrics> } = {},
) => {
  const provider = createFakeLlmProvider([], steps);
  vi.mocked(getLlmProvider).mockReturnValue(provider);
  const promise = feedbackService.generateFormFeedback({
    metrics: overrides.metrics ?? makeScoredMetrics(),
    context,
    log,
  });
  return { provider, promise };
};

const lastIssues = (
  provider: ReturnType<typeof createFakeLlmProvider>,
): string => {
  const req = provider.generateFormFeedback.mock.calls.at(-1)?.[0];
  return req?.userPrompt ?? "";
};

describe("feedbackService.generateFormFeedback", () => {
  it("returns validated feedback merged with server finding data", async () => {
    const { provider, promise } = run([result(goodDraft())]);

    const outcome = await promise;

    expect(outcome).toMatchObject({
      model: "claude-sonnet-5-5",
      promptVersion: FORM_FEEDBACK_PROMPT_VERSION,
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
    expect(req.signal).toBeInstanceOf(AbortSignal);
    expect(req.allowedTags).toEqual(["PU_HIP_SAG", "PU_SHALLOW_DEPTH"]);
    expect(req.timeoutMs).toBeGreaterThan(0);
    expect(req.timeoutMs).toBeLessThanOrEqual(env.analysis.llmTimeoutMs);
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

    expect(validation.isValid).toBe(false);
  });

  describe("with the shared forbidden topics", () => {
    const validateDetail = (detail: string) => {
      const draft = goodDraft();
      draft.corrections[0].detail = detail;
      return validateFormFeedback(
        draft,
        makeScoredMetrics({ forbiddenTopics: COMMON_FORBIDDEN_TOPICS }),
      );
    };

    it.for([
      "Shift your weight back onto your heels.",
      "Keep your hip height level.",
      "Keep your weight over your hands.",
      "Lower until your chest is at bar height.",
      "Keep your body in one line, no weights needed.",
    ])("accepts coaching wording: %s", (text) => {
      expect(validateDetail(text).isValid).toBe(true);
    });

    it.for([
      "This can feel painful.",
      "Avoid pains in the knee.",
      "Your body weight is a factor.",
      "At your body height this is easier.",
      "Given your height, a wider stance helps.",
      "At your weight, lower slowly.",
      "You weigh enough that tempo matters.",
      "Because you're tall, widen your grip.",
      "Taller athletes need more depth.",
      "Your 180 cm frame makes this harder.",
    ])("rejects body or pain wording: %s", (text) => {
      expect(validateDetail(text).isValid).toBe(false);
    });
  });

  it("rejects over-long summary and cue", () => {
    const draft = goodDraft({ summary: "a".repeat(201) });
    draft.corrections[0].cue = "b".repeat(121);

    const validation = validateFormFeedback(draft, makeScoredMetrics());

    expect(validation).toMatchObject({
      isValid: false,
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

  it.for(["REFUSAL", "INVALID_OUTPUT"] as const)(
    "logs each unusable %s attempt and throws that error, not a validation failure",
    async (code) => {
      vi.mocked(log.warn).mockClear();
      const { promise } = run([new LlmError(code), new LlmError(code)]);

      const error: unknown = await promise.catch((e: unknown) => e);

      expect(error).toBeInstanceOf(LlmError);
      expect(error).toMatchObject({ code });
      expect((error as LlmError).message).not.toMatch(/validation/);
      expect(log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ code, attempt: 1 }),
        "Form feedback attempt returned no usable output",
      );
      expect(log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ code, attempt: 2 }),
        "Form feedback attempt returned no usable output",
      );
    },
  );

  it("reports a validation failure when the last attempt was invalid after a refusal", async () => {
    const { promise } = run([
      new LlmError("REFUSAL"),
      result(goodDraft({ positives: [] })),
    ]);

    await expect(promise).rejects.toMatchObject({
      code: "INVALID_OUTPUT",
      message: "Form feedback failed validation after repair",
    });
  });

  it.for(["TIMEOUT", "RATE_LIMITED", "UNAVAILABLE"] as const)(
    "rethrows a provider %s immediately",
    async (code) => {
      const { provider, promise } = run([new LlmError(code)]);

      await expect(promise).rejects.toMatchObject({ code });
      expect(provider.generateFormFeedback).toHaveBeenCalledTimes(1);
    },
  );

  it("throws TIMEOUT instead of repairing when the budget is spent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const provider = createFakeLlmProvider(
        [],
        [result(goodDraft({ positives: [] }))],
      );
      provider.generateFormFeedback.mockImplementationOnce(() => {
        vi.advanceTimersByTime(env.analysis.llmTimeoutMs);
        return Promise.resolve(result(goodDraft({ positives: [] })) as never);
      });
      vi.mocked(getLlmProvider).mockReturnValue(provider);

      await expect(
        feedbackService.generateFormFeedback({
          metrics: makeScoredMetrics(),
          context,
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

  it("falls back to the finding's reps when the model returns none for a correction", async () => {
    const draft = goodDraft();
    draft.corrections[0].repNumbers = [];
    const { promise } = run([result(draft)]);

    const outcome = await promise;

    expect(outcome.attempts).toBe(1);
    expect(outcome.feedback.corrections[0]).toMatchObject({
      tag: "PU_HIP_SAG",
      repNumbers: [3, 4, 5],
    });
  });

  it("keeps the model's narrower reps when it supplies some", async () => {
    const draft = goodDraft();
    draft.corrections[0].repNumbers = [4];
    const { promise } = run([result(draft)]);

    const outcome = await promise;

    expect(outcome.feedback.corrections[0].repNumbers).toEqual([4]);
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
