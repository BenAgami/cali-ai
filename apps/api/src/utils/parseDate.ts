import BadRequestError from "../errors/BadRequestError";

/**
 * Parses an optional client-supplied date. Returns `undefined` when the value is
 * absent so callers can omit the field entirely and let the column default
 * apply, and throws when it is present but unparseable.
 */
export const parseOptionalDate = (
  value: string | undefined,
  fieldName: string,
): Date | undefined => {
  if (!value) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`Invalid ${fieldName} value`);
  }

  return parsed;
};
