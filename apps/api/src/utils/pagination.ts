type Page = {
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
};

export type PaginatedResult<T> = {
  items: T[];
  page: Page;
};

/**
 * Number of rows to request so a further page can be detected without a second
 * count query. Pair with {@link paginate}, which trims the extra row back off.
 */
export const lookAheadTake = (limit: number): number => limit + 1;

/**
 * Turns a look-ahead query result into the shared paginated response shape.
 * `rows` must have been fetched with `take: lookAheadTake(limit)`.
 */
export const paginate = <T>(
  rows: T[],
  limit: number,
  offset: number,
): PaginatedResult<T> => {
  const hasMore = rows.length > limit;

  return {
    items: hasMore ? rows.slice(0, limit) : rows,
    page: {
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    },
  };
};
