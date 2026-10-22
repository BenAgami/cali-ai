import type { Server } from "node:http";

type SignalHandler = (...args: unknown[]) => void;

const mockLogger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
};
const mockQueueClose = vi.fn();
const mockMaintenanceClose = vi.fn();
const mockStopWorkers = vi.fn();
const mockCloseProgressBus = vi.fn();
const mockRedisQuit = vi.fn();
const mockDisconnectPrisma = vi.fn();

vi.mock("../../../src/lib/logger", () => ({ logger: mockLogger }));
vi.mock("../../../src/lib/queue", () => ({
  formAnalysisQueue: { close: mockQueueClose },
  maintenanceQueue: { close: mockMaintenanceClose },
}));
vi.mock("../../../src/workers", () => ({ stopWorkers: mockStopWorkers }));
vi.mock("../../../src/lib/progressBus", () => ({
  closeProgressBus: mockCloseProgressBus,
}));
vi.mock("../../../src/lib/redis", () => ({
  redisConnection: { quit: mockRedisQuit },
}));
vi.mock("@repo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@repo/db")>()),
  disconnectPrisma: mockDisconnectPrisma,
}));

const registerAndCapture = async (getServer: () => Server | undefined) => {
  const handlers = new Map<string, SignalHandler>();
  vi.spyOn(process, "on").mockImplementation(((
    event: string,
    handler: SignalHandler,
  ) => {
    handlers.set(event, handler);
    return process;
  }) as unknown as typeof process.on);

  const { registerShutdownHandlers } =
    await import("../../../src/lib/shutdown");
  registerShutdownHandlers(getServer);

  return handlers;
};

beforeEach(() => {
  vi.resetModules();
  mockQueueClose.mockReset().mockResolvedValue(undefined);
  mockMaintenanceClose.mockReset().mockResolvedValue(undefined);
  mockStopWorkers.mockReset().mockResolvedValue(undefined);
  mockCloseProgressBus.mockReset().mockResolvedValue(undefined);
  mockRedisQuit.mockReset().mockResolvedValue(undefined);
  mockDisconnectPrisma.mockReset().mockResolvedValue(undefined);
  vi.spyOn(process, "exit").mockImplementation((): never => undefined as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registerShutdownHandlers", () => {
  it("registers handlers for both termination signals and both crash events", async () => {
    const handlers = await registerAndCapture(() => undefined);

    expect(handlers.has("SIGINT")).toBe(true);
    expect(handlers.has("SIGTERM")).toBe(true);
    expect(handlers.has("uncaughtException")).toBe(true);
    expect(handlers.has("unhandledRejection")).toBe(true);
  });

  it("closes the server, queue, redis, and prisma, then exits 0 on SIGINT", async () => {
    const close = vi.fn((cb: (err?: Error) => void) => cb());
    const server = { close } as unknown as Server;
    const handlers = await registerAndCapture(() => server);

    handlers.get("SIGINT")?.();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled());

    expect(close).toHaveBeenCalled();
    expect(mockQueueClose).toHaveBeenCalled();
    expect(mockRedisQuit).toHaveBeenCalled();
    expect(mockDisconnectPrisma).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("tears down in dependency order: server, workers, bus, queues, redis, prisma", async () => {
    const close = vi.fn((cb: (err?: Error) => void) => cb());
    const server = { close } as unknown as Server;
    const handlers = await registerAndCapture(() => server);

    handlers.get("SIGINT")?.();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(0));

    const order = [
      close,
      mockStopWorkers,
      mockCloseProgressBus,
      mockQueueClose,
      mockMaintenanceClose,
      mockRedisQuit,
      mockDisconnectPrisma,
    ].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });

  it("logs and exits 1 when server.close reports an error", async () => {
    const failure = new Error("already closed");
    const close = vi.fn((cb: (err?: Error) => void) => cb(failure));
    const server = { close } as unknown as Server;
    const handlers = await registerAndCapture(() => server);

    handlers.get("SIGINT")?.();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled());

    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: failure },
      "Error during graceful shutdown",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("skips server.close when no server is running", async () => {
    const handlers = await registerAndCapture(() => undefined);

    handlers.get("SIGTERM")?.();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled());

    expect(mockQueueClose).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("logs and exits 1 when a cleanup step throws", async () => {
    const failure = new Error("redis down");
    mockRedisQuit.mockRejectedValueOnce(failure);
    const handlers = await registerAndCapture(() => undefined);

    handlers.get("SIGINT")?.();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled());

    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: failure },
      "Error during graceful shutdown",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("logs fatal and exits 1 on uncaughtException", async () => {
    const error = new Error("boom");
    const handlers = await registerAndCapture(() => undefined);

    handlers.get("uncaughtException")?.(error);
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled());

    expect(mockLogger.fatal).toHaveBeenCalledWith(
      { err: error },
      "Uncaught exception",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("logs fatal and exits 1 on unhandledRejection", async () => {
    const reason = new Error("nope");
    const handlers = await registerAndCapture(() => undefined);

    handlers.get("unhandledRejection")?.(reason);
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalled());

    expect(mockLogger.fatal).toHaveBeenCalledWith(
      { err: reason },
      "Unhandled promise rejection",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("ignores a second signal while a shutdown is already in progress", async () => {
    mockQueueClose.mockImplementation(() => new Promise(() => {}));
    const handlers = await registerAndCapture(() => undefined);

    handlers.get("SIGINT")?.();
    handlers.get("SIGTERM")?.();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Received SIGTERM during shutdown, ignoring",
    );
    await vi.waitFor(() => expect(mockQueueClose).toHaveBeenCalled());
    expect(mockQueueClose).toHaveBeenCalledTimes(1);
  });

  it("force-exits with code 1 if cleanup does not finish within the timeout", async () => {
    vi.useFakeTimers();
    mockQueueClose.mockImplementation(() => new Promise(() => {}));
    const handlers = await registerAndCapture(() => undefined);

    handlers.get("SIGINT")?.();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Graceful shutdown timed out, forcing exit",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
