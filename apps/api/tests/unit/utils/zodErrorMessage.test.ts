import { z, ZodError } from "zod";

import { getZodErrorMessage } from "../../../src/utils/zodErrorMessage";

/** Produces a real ZodError rather than hand-constructing issue objects. */
const zodErrorFor = (schema: z.ZodType, value: unknown): ZodError => {
  const result = schema.safeParse(value);
  if (result.success)
    throw new Error("Expected the schema to reject the value");
  return result.error;
};

describe("getZodErrorMessage", () => {
  it("joins the issue path with dots and appends the message", () => {
    const schema = z.object({ body: z.object({ email: z.email() }) });
    const result = getZodErrorMessage(
      zodErrorFor(schema, { body: { email: "nope" } }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].message).toMatch(/^body\.email - /);
  });

  it("returns one entry per issue, in error.issues order", () => {
    const schema = z.object({
      email: z.email(),
      age: z.number(),
    });
    const error = zodErrorFor(schema, { email: "nope", age: "old" });
    const result = getZodErrorMessage(error);

    expect(result).toHaveLength(error.issues.length);
    expect(result.map((r) => r.message.split(" - ")[0])).toEqual(
      error.issues.map((issue) => issue.path.join(".")),
    );
  });

  it("renders numeric array indices as path segments", () => {
    const schema = z.object({
      body: z.object({
        exercises: z.array(z.object({ reps: z.number() })),
      }),
    });
    const result = getZodErrorMessage(
      zodErrorFor(schema, { body: { exercises: [{ reps: "ten" }] } }),
    );

    expect(result[0].message).toMatch(/^body\.exercises\.0\.reps - /);
  });

  it("omits the separator for a root-level issue with an empty path", () => {
    const error = zodErrorFor(z.string(), 42);
    const result = getZodErrorMessage(error);

    expect(result[0].message).toBe(error.issues[0].message);
  });

  it("returns an empty array when the error carries no issues", () => {
    expect(getZodErrorMessage(new ZodError([]))).toEqual([]);
  });
});
