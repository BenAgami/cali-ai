import z, { ZodError } from "zod";

type ZodErrorMessage = { message: string }[];

export const getZodErrorMessage = (error: ZodError): ZodErrorMessage => {
  return error.issues.map((issue: z.core.$ZodIssue) => ({
    message: `${issue.path.join(".")} - ${issue.message}`,
  }));
};
