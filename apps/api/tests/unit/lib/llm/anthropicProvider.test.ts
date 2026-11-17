import Anthropic from "@anthropic-ai/sdk";

import { AnthropicProvider } from "../../../../src/lib/llm/anthropicProvider";
import {
  type FormFeedbackRequest,
  LlmError,
  type WorkoutPlanRequest,
} from "../../../../src/lib/llm/types";

const draft = {
  name: "Push day",
  note: null,
  exercises: [
    {
      exerciseCode: "push-up",
      sets: 3,
      reps: 10,
      durationSecs: null,
      restSecs: 60,
    },
  ],
};

const makeRequest = (): WorkoutPlanRequest => ({
  model: "claude-haiku-5-5",
  effort: "low",
  maxTokens: 1000,
  timeoutMs: 5000,
  signal: new AbortController().signal,
  system: "sys",
  userPrompt: "usr",
  exerciseCodes: ["push-up", "squat"],
});

const setup = () => {
  const parse = vi.fn();
  const provider = new AnthropicProvider({
    messages: { parse },
  } as unknown as Anthropic);
  return { parse, provider };
};

const okMessage = (overrides: Record<string, unknown> = {}) => ({
  stop_reason: "end_turn",
  parsed_output: draft,
  model: "claude-haiku-5-5",
  usage: { input_tokens: 10, output_tokens: 20 },
  ...overrides,
});

const expectCode = async (promise: Promise<unknown>, code: string) => {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(LlmError);
  expect((error as LlmError).code).toBe(code);
  return error as LlmError;
};

describe("AnthropicProvider.generateWorkoutPlan", () => {
  it("returns the plan, model and usage", async () => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(okMessage());

    await expect(provider.generateWorkoutPlan(makeRequest())).resolves.toEqual({
      plan: draft,
      model: "claude-haiku-5-5",
      usage: { inputTokens: 10, outputTokens: 20 },
    });
  });

  it("passes request params and disables SDK retries", async () => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(okMessage());
    const req = makeRequest();

    await provider.generateWorkoutPlan(req);

    const [params, options] = parse.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(params).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 1000,
      system: "sys",
      messages: [{ role: "user", content: "usr" }],
      output_config: { effort: "low" },
    });
    expect(params).not.toHaveProperty("thinking");
    expect(
      (params.output_config as Record<string, unknown>).format,
    ).toBeDefined();
    expect(options).toEqual({
      signal: req.signal,
      timeout: 5000,
      maxRetries: 0,
    });
  });

  it.for([
    ["a refusal", { stop_reason: "refusal" }, "REFUSAL"],
    ["max_tokens", { stop_reason: "max_tokens" }, "INVALID_OUTPUT"],
    ["null parsed_output", { parsed_output: null }, "INVALID_OUTPUT"],
  ] as const)("maps %s to %s", async ([, overrides, code]) => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(okMessage(overrides));

    await expectCode(provider.generateWorkoutPlan(makeRequest()), code);
  });

  const headers = new Headers();
  it.for([
    [
      "RATE_LIMITED",
      () => new Anthropic.RateLimitError(429, {}, "slow down", headers),
    ],
    ["TIMEOUT", () => new Anthropic.APIConnectionTimeoutError()],
    ["TIMEOUT", () => new Anthropic.APIUserAbortError()],
    [
      "TIMEOUT",
      () => Object.assign(new Error("aborted"), { name: "AbortError" }),
    ],
    [
      "UNAVAILABLE",
      () => new Anthropic.InternalServerError(500, {}, "boom", headers),
    ],
    [
      "UNAVAILABLE",
      () => new Anthropic.APIError(529, {}, "overloaded", headers),
    ],
    [
      "UNAVAILABLE",
      () => new Anthropic.AuthenticationError(401, {}, "bad key", headers),
    ],
    ["INVALID_OUTPUT", () => new Error("zod parse failure")],
  ] as const)("maps a rejection to %s", async ([code, makeError]) => {
    const { parse, provider } = setup();
    const cause = makeError();
    parse.mockRejectedValue(cause);

    const error = await expectCode(
      provider.generateWorkoutPlan(makeRequest()),
      code,
    );
    expect(error.cause).toBe(cause);
  });
});

describe("AnthropicProvider.generateFormFeedback", () => {
  const feedback = {
    summary: "Solid set.",
    positives: [{ text: "Great depth", repNumbers: [1] }],
    corrections: [],
  };
  const makeFormRequest = (
    allowedTags: string[] = [],
  ): FormFeedbackRequest => ({
    model: "claude-sonnet-5-5",
    effort: "low",
    maxTokens: 1200,
    timeoutMs: 4000,
    signal: new AbortController().signal,
    system: "sys",
    userPrompt: "usr",
    allowedTags,
  });
  const formMessage = (overrides: Record<string, unknown> = {}) =>
    okMessage({ parsed_output: feedback, ...overrides });

  const tagSchema = (parse: ReturnType<typeof vi.fn>) => {
    const [params] = parse.mock.calls[0] as [
      { output_config: { format: { schema: unknown } } },
    ];
    return JSON.stringify(params.output_config.format.schema);
  };

  it("returns feedback, model and usage", async () => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(formMessage());

    await expect(
      provider.generateFormFeedback(makeFormRequest()),
    ).resolves.toEqual({
      feedback,
      model: "claude-haiku-5-5",
      usage: { inputTokens: 10, outputTokens: 20 },
    });
  });

  it("passes signal, timeout, maxRetries 0 and effort", async () => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(formMessage());
    const req = makeFormRequest();

    await provider.generateFormFeedback(req);

    const [params, options] = parse.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(params).toMatchObject({
      max_tokens: 1200,
      output_config: { effort: "low" },
    });
    expect(options).toEqual({
      signal: req.signal,
      timeout: 4000,
      maxRetries: 0,
    });
  });

  it("restricts errorTag to an enum of the allowed tags", async () => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(formMessage());

    await provider.generateFormFeedback(makeFormRequest(["PU_HIP_SAG"]));

    expect(tagSchema(parse)).toContain('enum: [\\"PU_HIP_SAG\\"]');
  });

  it("uses a plain string errorTag when there are no allowed tags", async () => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(formMessage());

    await provider.generateFormFeedback(makeFormRequest([]));

    expect(tagSchema(parse)).not.toContain("enum:");
  });

  it.for([
    ["a refusal", { stop_reason: "refusal" }, "REFUSAL"],
    ["max_tokens", { stop_reason: "max_tokens" }, "INVALID_OUTPUT"],
    ["null parsed_output", { parsed_output: null }, "INVALID_OUTPUT"],
  ] as const)("maps %s to %s", async ([, overrides, code]) => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(formMessage(overrides));

    await expectCode(provider.generateFormFeedback(makeFormRequest()), code);
  });

  it("maps an abort to TIMEOUT and a rate limit to RATE_LIMITED", async () => {
    const { parse, provider } = setup();
    parse.mockRejectedValueOnce(new Anthropic.APIUserAbortError());
    await expectCode(
      provider.generateFormFeedback(makeFormRequest()),
      "TIMEOUT",
    );

    parse.mockRejectedValueOnce(
      new Anthropic.RateLimitError(429, {}, "slow", new Headers()),
    );
    await expectCode(
      provider.generateFormFeedback(makeFormRequest()),
      "RATE_LIMITED",
    );
  });
});
