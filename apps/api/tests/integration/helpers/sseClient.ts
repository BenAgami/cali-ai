import { get, type IncomingHttpHeaders } from "node:http";

export type SseEvent = { event: string; data: unknown };

export type SseConnection = {
  statusCode: number;
  headers: IncomingHttpHeaders;
  events: SseEvent[];
  waitForEvents: (count: number, timeoutMs?: number) => Promise<SseEvent[]>;
  ended: Promise<void>;
  close: () => void;
};

const parseBlock = (block: string): SseEvent | null => {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }

  if (dataLines.length === 0) return null;
  return { event, data: JSON.parse(dataLines.join("\n")) as unknown };
};

/**
 * Minimal incremental SSE reader. supertest buffers the whole response, so it
 * cannot observe a stream that stays open.
 */
export const openSse = (
  baseUrl: string,
  path: string,
  token?: string,
): Promise<SseConnection> =>
  new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const request = get(`${baseUrl}${path}`, { headers }, (response) => {
      const events: SseEvent[] = [];
      let buffer = "";

      const ended = new Promise<void>((done) => {
        response.on("end", done);
        response.on("close", done);
      });

      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        buffer += chunk;
        let index = buffer.indexOf("\n\n");
        while (index !== -1) {
          const parsed = parseBlock(buffer.slice(0, index));
          if (parsed) events.push(parsed);
          buffer = buffer.slice(index + 2);
          index = buffer.indexOf("\n\n");
        }
      });

      const waitForEvents = async (
        count: number,
        timeoutMs = 5000,
      ): Promise<SseEvent[]> => {
        const deadline = Date.now() + timeoutMs;
        while (events.length < count) {
          if (Date.now() > deadline) {
            throw new Error(
              `Timed out waiting for ${count} SSE events; received ${events.length}`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return events;
      };

      resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        events,
        waitForEvents,
        ended,
        close: () => request.destroy(),
      });
    });

    request.on("error", reject);
  });
