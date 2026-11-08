import { envSchema } from "../../../src/config/env";

import { unitEnv } from "../helpers/unitEnv";

/** Minimum set of variables with no schema default. */
const requiredEnv = {
  DATABASE_URL: "postgresql://u:p@127.0.0.1:1/db?schema=public",
  JWT_SECRET: "a".repeat(32),
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET_NAME: "bucket",
  R2_PUBLIC_DOMAIN: "cdn.example.com",
};

const parse = (overrides: Record<string, unknown> = {}) =>
  envSchema.parse({ ...requiredEnv, ...overrides });

const expectIssueOn = (key: string, overrides: Record<string, unknown>) => {
  const result = envSchema.safeParse({ ...requiredEnv, ...overrides });
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(result.error.issues.some((issue) => issue.path[0] === key)).toBe(true);
};

describe("envSchema", () => {
  describe("R2_PUBLIC_DOMAIN", () => {
    it.for([
      ["https://", "https://cdn.example.com"],
      ["http://", "http://cdn.example.com"],
    ])("strips a leading %s scheme", ([_label, input]) => {
      expect(parse({ R2_PUBLIC_DOMAIN: input }).R2_PUBLIC_DOMAIN).toBe(
        "cdn.example.com",
      );
    });

    it("leaves a bare domain untouched", () => {
      expect(parse().R2_PUBLIC_DOMAIN).toBe("cdn.example.com");
    });

    it("only strips a scheme at the start of the string", () => {
      expect(
        parse({ R2_PUBLIC_DOMAIN: "cdn.example.com/https://x" })
          .R2_PUBLIC_DOMAIN,
      ).toBe("cdn.example.com/https://x");
    });

    it("rejects an empty value", () => {
      expectIssueOn("R2_PUBLIC_DOMAIN", { R2_PUBLIC_DOMAIN: "" });
    });
  });

  describe("duration strings", () => {
    it.for(["15m", "7d", "1000", "2 hours"])("accepts %s", (value) => {
      expect(parse({ JWT_EXPIRES_IN: value }).JWT_EXPIRES_IN).toBe(value);
    });

    it.for([
      ["a non-duration string", "banana"],
      ["a number", 15],
    ])("rejects %s", ([_label, value]) => {
      expectIssueOn("JWT_EXPIRES_IN", { JWT_EXPIRES_IN: value });
    });
  });

  describe("JWT_SECRET", () => {
    it("accepts a 32-character secret", () => {
      expect(parse({ JWT_SECRET: "b".repeat(32) }).JWT_SECRET).toHaveLength(32);
    });

    it("rejects a shorter secret with an explanatory message", () => {
      const result = envSchema.safeParse({
        ...requiredEnv,
        JWT_SECRET: "too-short",
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(
        result.error.issues.find((issue) => issue.path[0] === "JWT_SECRET")
          ?.message,
      ).toBe("JWT_SECRET must be at least 32 characters");
    });
  });

  describe("coercion and defaults", () => {
    it("coerces PORT to a number", () => {
      expect(parse({ PORT: "8080" }).PORT).toBe(8080);
    });

    it("applies every default when only required vars are supplied", () => {
      const parsed = parse();

      expect(parsed.NODE_ENV).toBe("development");
      expect(parsed.PORT).toBe(3000);
      expect(parsed.SERVICE_NAME).toBe("api");
      expect(parsed.LOG_LEVEL).toBeUndefined();
      expect(parsed.JWT_EXPIRES_IN).toBe("15m");
      expect(parsed.REFRESH_TOKEN_EXPIRES_IN).toBe("7d");
      expect(parsed.REDIS_URL).toBe("redis://localhost:6379");
      expect(parsed.CORS_ALLOWED_ORIGINS).toBe("http://localhost:8081");
      expect(parsed.ANALYSIS_MAX_ATTEMPTS).toBe(3);
      expect(parsed.ANALYSIS_BACKOFF_DELAY_MS).toBe(2000);
      expect(parsed.ANALYSIS_LLM_TIMEOUT_MS).toBe(40000);
      expect(parsed.ANALYSIS_STUCK_TIMEOUT_MS).toBe(150000);
      expect(parsed.ANALYSIS_REAPER_INTERVAL_MS).toBe(15000);
    });

    it("rejects an unknown NODE_ENV", () => {
      expectIssueOn("NODE_ENV", { NODE_ENV: "staging" });
    });

    it("rejects a DATABASE_URL that is not a URL", () => {
      expectIssueOn("DATABASE_URL", { DATABASE_URL: "not-a-url" });
    });
  });

  describe("analysis retry budget", () => {
    it("accepts the defaults", () => {
      expect(() => parse()).not.toThrow();
    });

    it("rejects a stuck timeout below the retry budget (141000 ms)", () => {
      expectIssueOn("ANALYSIS_STUCK_TIMEOUT_MS", {
        ANALYSIS_STUCK_TIMEOUT_MS: "120000",
      });
    });

    it("rejects more attempts than the stuck timeout can cover", () => {
      expectIssueOn("ANALYSIS_STUCK_TIMEOUT_MS", {
        ANALYSIS_MAX_ATTEMPTS: "5",
      });
    });

    it("accepts a shorter LLM timeout with a longer stuck timeout", () => {
      expect(() =>
        parse({
          ANALYSIS_LLM_TIMEOUT_MS: "30000",
          ANALYSIS_STUCK_TIMEOUT_MS: "160000",
        }),
      ).not.toThrow();
    });

    it("rejects a reaper interval that pushes past the 3-minute ceiling", () => {
      expectIssueOn("ANALYSIS_REAPER_INTERVAL_MS", {
        ANALYSIS_REAPER_INTERVAL_MS: "60000",
      });
    });

    it("rejects a stuck timeout plus reaper interval above 180000 ms", () => {
      expectIssueOn("ANALYSIS_REAPER_INTERVAL_MS", {
        ANALYSIS_STUCK_TIMEOUT_MS: "170000",
      });
    });

    it("rejects zero attempts", () => {
      expectIssueOn("ANALYSIS_MAX_ATTEMPTS", { ANALYSIS_MAX_ATTEMPTS: "0" });
    });
  });
});

describe("LLM and generation env", () => {
  it("applies the documented defaults", () => {
    const parsed = parse();

    expect(parsed.LLM_MODEL_PRIMARY).toBe("claude-sonnet-5-5");
    expect(parsed.LLM_MODEL_FALLBACK).toBe("claude-sonnet-5-5");
    expect(parsed.LLM_EFFORT_PRIMARY).toBe("medium");
    expect(parsed.LLM_EFFORT_FALLBACK).toBe("high");
    expect(parsed.LLM_PRIMARY_TIMEOUT_MS).toBe(15000);
    expect(parsed.LLM_FALLBACK_TIMEOUT_MS).toBe(25000);
    expect(parsed.LLM_MAX_TOKENS).toBe(2000);
    expect(parsed.AI_GENERATION_DAILY_CAP).toBe(10);
    expect(parsed.AI_GENERATION_DEADLINE_MS).toBe(60000);
  });

  it("requires ANTHROPIC_API_KEY in production", () => {
    expectIssueOn("ANTHROPIC_API_KEY", { NODE_ENV: "production" });
  });

  it("allows a missing ANTHROPIC_API_KEY in development", () => {
    expect(() => parse({ NODE_ENV: "development" })).not.toThrow();
  });

  it("rejects a deadline shorter than two primary plus one fallback attempt", () => {
    expectIssueOn("AI_GENERATION_DEADLINE_MS", {
      AI_GENERATION_DEADLINE_MS: "54000",
    });
  });

  it("rejects an unknown effort level", () => {
    expectIssueOn("LLM_EFFORT_PRIMARY", { LLM_EFFORT_PRIMARY: "extreme" });
  });
});

describe("unit project env", () => {
  it("supplies inline values for exactly the vars envSchema declares", () => {
    expect(Object.keys(unitEnv).sort()).toEqual(
      Object.keys(envSchema.shape).sort(),
    );
  });
});
