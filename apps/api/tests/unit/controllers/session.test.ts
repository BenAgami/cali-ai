import type { Request } from "express";

import { ConflictError, NotFoundError } from "../../../src/errors";
import { analysisStreamService } from "../../../src/services/analysisStreamService";
import { openSseStream, type SseStream } from "../../../src/lib/sse";

import { createMockRequest, createMockResponse } from "../helpers/expressMocks";

vi.mock("../../../src/services/analysisStreamService", () => ({
  analysisStreamService: { assertStreamable: vi.fn(), attach: vi.fn() },
}));
vi.mock("../../../src/lib/sse", () => ({ openSseStream: vi.fn() }));
vi.mock("../../../src/services/captureService", () => ({
  default: { submitCapture: vi.fn(), retryAnalysis: vi.fn() },
}));

const { streamAnalysisStatus } =
  await import("../../../src/controllers/session");

const createStream = (): SseStream => ({
  send: vi.fn(),
  close: vi.fn(),
  onClose: vi.fn(),
  isClosed: vi.fn(),
});

const run = async () => {
  const req = createMockRequest({
    params: { id: "42" },
    user: { sub: "user-uuid" } as Request["user"],
  });
  const res = createMockResponse();
  let error: unknown;

  await streamAnalysisStatus(req, res).catch((err: unknown) => {
    error = err;
  });

  return { req, res, error };
};

describe("streamAnalysisStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([new ConflictError("No analysis"), new NotFoundError("Missing")])(
    "rejects with %s before opening the stream",
    async (failure) => {
      vi.mocked(analysisStreamService.assertStreamable).mockRejectedValue(
        failure,
      );

      const { error } = await run();

      expect(error).toBe(failure);
      expect(openSseStream).not.toHaveBeenCalled();
      expect(analysisStreamService.attach).not.toHaveBeenCalled();
    },
  );

  it("asserts streamable before opening the stream", async () => {
    vi.mocked(analysisStreamService.assertStreamable).mockResolvedValue();
    vi.mocked(openSseStream).mockReturnValue(createStream());

    await run();

    expect(analysisStreamService.assertStreamable).toHaveBeenCalledWith(
      "user-uuid",
      42,
    );
    expect(
      vi.mocked(analysisStreamService.assertStreamable).mock
        .invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(openSseStream).mock.invocationCallOrder[0]);
  });

  it("attaches a sink that delegates to the stream", async () => {
    const stream = createStream();
    vi.mocked(analysisStreamService.assertStreamable).mockResolvedValue();
    vi.mocked(openSseStream).mockReturnValue(stream);

    await run();

    expect(analysisStreamService.attach).toHaveBeenCalledOnce();
    const [sessionId, sink] = vi.mocked(analysisStreamService.attach).mock
      .calls[0];
    expect(sessionId).toBe(42);

    const event = {
      sessionId: 42,
      status: "QUEUED" as const,
      stage: "QUEUED" as const,
      stage_label: "Queued",
      progress_percent: 0,
      failure_reason: null,
    };
    sink.send(event);
    expect(stream.send).toHaveBeenCalledWith("status", event);
    expect(sink.close).toBe(stream.close);
    expect(sink.onClose).toBe(stream.onClose);
  });
});
