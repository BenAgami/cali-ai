import BadRequestError from "../../../src/errors/BadRequestError";
import { parseOptionalDate } from "../../../src/utils/parseDate";

describe("parseOptionalDate", () => {
  it("parses a valid ISO string into a Date", () => {
    expect(
      parseOptionalDate("2026-01-01T00:00:00.000Z", "performedAt"),
    ).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });

  it.for([
    ["undefined", undefined],
    ["an empty string", ""],
  ])(
    "returns undefined for %s so the caller can omit the field",
    ([_label, value]) => {
      expect(parseOptionalDate(value, "performedAt")).toBeUndefined();
    },
  );

  it.for(["not-a-date", "2026-13-45"])("rejects %s", (value) => {
    expect(() => parseOptionalDate(value, "performedAt")).toThrow(
      new BadRequestError("Invalid performedAt value"),
    );
  });

  it("names the offending field in the error message", () => {
    expect(() => parseOptionalDate("garbage", "completedAt")).toThrow(
      "Invalid completedAt value",
    );
  });
});
