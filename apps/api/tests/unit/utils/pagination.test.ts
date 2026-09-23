import { lookAheadTake, paginate } from "../../../src/utils/pagination";

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1 }));

describe("lookAheadTake", () => {
  it("requests one row beyond the page size", () => {
    expect(lookAheadTake(10)).toBe(11);
  });
});

describe("paginate", () => {
  it("trims the look-ahead row and reports a further page", () => {
    const result = paginate(rows(11), 10, 20);

    expect(result.items).toHaveLength(10);
    expect(result.items.at(-1)).toEqual({ id: 10 });
    expect(result.page).toEqual({
      limit: 10,
      offset: 20,
      hasMore: true,
      nextOffset: 30,
    });
  });

  it("returns a partial page as-is with no further page", () => {
    const result = paginate(rows(4), 10, 0);

    expect(result.items).toHaveLength(4);
    expect(result.page).toEqual({
      limit: 10,
      offset: 0,
      hasMore: false,
      nextOffset: null,
    });
  });

  it("reports no further page when exactly limit rows come back", () => {
    const result = paginate(rows(10), 10, 0);

    expect(result.items).toHaveLength(10);
    expect(result.page).toMatchObject({ hasMore: false, nextOffset: null });
  });

  it("handles an empty result set", () => {
    const result = paginate([], 10, 0);

    expect(result.items).toEqual([]);
    expect(result.page).toMatchObject({ hasMore: false, nextOffset: null });
  });

  it("advances nextOffset from the current offset, not from zero", () => {
    expect(paginate(rows(6), 5, 15).page.nextOffset).toBe(20);
  });

  it("returns the original array instance when there is no further page", () => {
    const input = rows(3);

    expect(paginate(input, 10, 0).items).toBe(input);
  });
});
