/** A route param as a positive integer; null when missing or malformed. */
export const parsePositiveIntParam = (
  value: string | undefined,
): number | null => {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
