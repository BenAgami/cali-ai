import { normalizeString } from "../../../src/utils/normalizeString";

describe("normalizeString", () => {
  it("lowercases and trims", () => {
    expect(normalizeString("  MixedCase@Example.COM  ")).toBe(
      "mixedcase@example.com",
    );
  });

  it("lowercases without trimming when there is no surrounding whitespace", () => {
    expect(normalizeString("PUSH_UP")).toBe("push_up");
  });

  it("preserves internal whitespace", () => {
    expect(normalizeString("  A B  ")).toBe("a b");
  });

  it.for([
    ["an empty string", "", ""],
    ["a whitespace-only string", "   \t\n ", ""],
  ])("returns an empty string for %s", ([_label, input, expected]) => {
    expect(normalizeString(input)).toBe(expected);
  });
});
