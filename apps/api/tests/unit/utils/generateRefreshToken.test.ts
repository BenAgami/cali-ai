import crypto from "crypto";

import { generateRefreshToken } from "../../../src/utils/generateRefreshToken";

const HEX_64 = /^[0-9a-f]{64}$/;

describe("generateRefreshToken", () => {
  it("returns a raw token of 32 random bytes as hex", () => {
    expect(generateRefreshToken().raw).toMatch(HEX_64);
  });

  it("returns a sha256 hash as hex", () => {
    expect(generateRefreshToken().hash).toMatch(HEX_64);
  });

  it("hashes the raw token with sha256", () => {
    const { raw, hash } = generateRefreshToken();
    const expected = crypto.createHash("sha256").update(raw).digest("hex");

    expect(hash).toBe(expected);
  });

  it("produces a different raw token and hash on each call", () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first.raw).not.toBe(second.raw);
    expect(first.hash).not.toBe(second.hash);
  });

  it("does not repeat a raw token across 50 calls", () => {
    const tokens = Array.from({ length: 50 }, () => generateRefreshToken().raw);

    expect(new Set(tokens).size).toBe(50);
  });
});
