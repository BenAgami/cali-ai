import {
  PrismaErrorCode,
  isPrismaKnownRequestError,
} from "../../../src/utils/prismaErrorCodes";

describe("PrismaErrorCode", () => {
  it("maps the unique constraint violation to P2002", () => {
    expect(PrismaErrorCode.UNIQUE_CONSTRAINT_VIOLATION).toBe("P2002");
  });
});

describe("isPrismaKnownRequestError", () => {
  it("accepts an object carrying a code", () => {
    expect(isPrismaKnownRequestError({ code: "P2002" })).toBe(true);
  });

  it("accepts an Error instance carrying a code", () => {
    const error = Object.assign(new Error("boom"), { code: "P2002" });
    expect(isPrismaKnownRequestError(error)).toBe(true);
  });

  it("rejects a non-string code", () => {
    expect(isPrismaKnownRequestError({ code: 123 })).toBe(false);
  });

  it.for([
    ["null", null],
    ["undefined", undefined],
    ["a string", "P2002"],
    ["a number", 42],
    ["an array", []],
    ["an object without a code", { message: "boom" }],
  ])("rejects %s", ([_label, input]) => {
    expect(isPrismaKnownRequestError(input)).toBe(false);
  });
});
