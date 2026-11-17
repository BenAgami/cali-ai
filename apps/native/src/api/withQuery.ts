type QueryValue = string | number | undefined;

/** Appends the defined params to `path` as a URLSearchParams query string. */
export const withQuery = (
  path: string,
  params: Record<string, QueryValue>,
): string => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
};
