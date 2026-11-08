import { createFakeJob } from "../helpers/bullmqJob";

const mockState = vi.hoisted(() => ({ reapStuck: vi.fn() }));
const mockChild = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
const mockLogger = vi.hoisted(() => ({ child: vi.fn() }));

vi.mock("../../../src/services/analysisStateService", () => ({
  default: mockState,
}));
vi.mock("../../../src/lib/logger", () => ({ logger: mockLogger }));

import { processReapJob } from "../../../src/workers/reaperProcessor";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  mockLogger.child.mockReturnValue(mockChild);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("processReapJob", () => {
  it("reaps with the current time and the child logger, warning on hits", async () => {
    mockState.reapStuck.mockResolvedValue([4, 5]);

    const result = await processReapJob(createFakeJob({ id: "r1", data: {} }));

    expect(mockLogger.child).toHaveBeenCalledWith({ jobId: "r1" });
    expect(mockState.reapStuck).toHaveBeenCalledWith(
      new Date("2026-01-01T00:00:00Z"),
      mockChild,
    );
    expect(result).toEqual({ reaped: 2 });
    expect(mockChild.warn).toHaveBeenCalledWith(
      { sessionIds: [4, 5] },
      expect.any(String),
    );
  });

  it("stays quiet when nothing is stuck", async () => {
    mockState.reapStuck.mockResolvedValue([]);

    const result = await processReapJob(createFakeJob({ id: "r2", data: {} }));

    expect(result).toEqual({ reaped: 0 });
    expect(mockChild.warn).not.toHaveBeenCalled();
  });
});
