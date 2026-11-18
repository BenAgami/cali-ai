import { TimeoutError, withTimeout } from "../../../src/utils/withTimeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the inner value and clears its timer", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with the inner error and clears its timer", async () => {
    const boom = new Error("boom");
    await expect(withTimeout(Promise.reject(boom), 1000)).rejects.toBe(boom);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with a TimeoutError when the deadline passes first", async () => {
    const pending = new Promise<string>(() => undefined);
    const result = withTimeout(pending, 500);
    const assertion = expect(result).rejects.toMatchObject({
      name: "TimeoutError",
      timeoutMs: 500,
    });
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    await expect(result).rejects.toBeInstanceOf(TimeoutError);
  });

  it("does not reject before the deadline", async () => {
    const pending = new Promise<string>(() => undefined);
    const onSettle = vi.fn();
    withTimeout(pending, 500).then(onSettle, onSettle);
    await vi.advanceTimersByTimeAsync(499);
    expect(onSettle).not.toHaveBeenCalled();
  });
});
