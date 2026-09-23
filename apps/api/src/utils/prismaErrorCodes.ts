export const PrismaErrorCode = {
  UNIQUE_CONSTRAINT_VIOLATION: "P2002",
} as const;

type PrismaKnownRequestError = {
  code: string;
  meta?: { target?: unknown };
};

export const isPrismaKnownRequestError = (
  error: unknown,
): error is PrismaKnownRequestError =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string";
