import z, { ZodError } from "zod";

type ZodErrorMessage = { message: string }[];

export const getZodErrorMessage = (error: ZodError): ZodErrorMessage => {
  return error.issues.map((issue: z.core.$ZodIssue) => {
    const path = issue.path.join(".");
    return { message: path ? `${path} - ${issue.message}` : issue.message };
  });
};
