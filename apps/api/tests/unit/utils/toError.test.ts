import { toError } from "../../../src/utils/toError";
import NotFoundError from "../../../src/errors/NotFoundError";

describe("toError", () => {
  describe("Error values", () => {
    it("returns the same instance, not a copy", () => {
      const original = new Error("boom");
      expect(toError(original)).toBe(original);
    });

    it("passes an ApiError subclass through with its status intact", () => {
      const original = new NotFoundError("missing");
      const result = toError(original);

      expect(result).toBe(original);
      expect((result as NotFoundError).status).toBe(404);
    });
  });

  describe("object values", () => {
    it("uses a string message property as the error message", () => {
      expect(toError({ message: "boom" }).message).toBe("boom");
    });

    it("keeps the stringified fallback when the source has a non-string message property", () => {
      const result = toError({ message: 42 });

      expect(result.message).toBe('{"message":42}');
      expect(typeof result.message).toBe("string");
    });

    it("stringifies an object with no message property", () => {
      expect(toError({ a: 1 }).message).toBe('{"a":1}');
    });

    it("falls back to Object#toString when the object is circular", () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      // JSON.stringify throws on circular refs; safeStringify catches it.
      expect(toError(circular).message).toBe("[object Object]");
    });

    it("copies the source object's own properties onto the error", () => {
      const result = toError({ message: "boom", code: "E_X", status: 418 });

      expect(result.message).toBe("boom");
      expect((result as Error & { code: string }).code).toBe("E_X");
      expect((result as Error & { status: number }).status).toBe(418);
    });
  });

  describe("primitive values", () => {
    it.for([
      ["a string", "str", "str"],
      ["a number", 42, "42"],
      ["a boolean", true, "true"],
      ["undefined", undefined, "undefined"],
    ])("stringifies %s", ([_label, input, expected]) => {
      const result = toError(input);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(expected);
    });

    it("treats null as a primitive despite typeof null === 'object'", () => {
      // The `value &&` short-circuit sends null down the primitive branch.
      expect(toError(null).message).toBe("null");
    });
  });
});
