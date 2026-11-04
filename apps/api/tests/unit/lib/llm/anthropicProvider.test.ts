import Anthropic from "@anthropic-ai/sdk";

import { AnthropicProvider } from "../../../../src/lib/llm/anthropicProvider";
import {
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
  user: "usr",
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

  it("maps a refusal", async () => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(okMessage({ stop_reason: "refusal" }));
    await expectCode(provider.generateWorkoutPlan(makeRequest()), "REFUSAL");
  });

  it("maps max_tokens to INVALID_OUTPUT", async () => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(okMessage({ stop_reason: "max_tokens" }));
    await expectCode(
      provider.generateWorkoutPlan(makeRequest()),
      "INVALID_OUTPUT",
    );
  });

  it("maps null parsed_output to INVALID_OUTPUT", async () => {
    const { parse, provider } = setup();
    parse.mockResolvedValue(okMessage({ parsed_output: null }));
    await expectCode(
      provider.generateWorkoutPlan(makeRequest()),
      "INVALID_OUTPUT",
    );
  });

  const headers = new Headers();
  it.each([
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
  ])("maps a rejection to %s", async (code, makeError) => {
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
