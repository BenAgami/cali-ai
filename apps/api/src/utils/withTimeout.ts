import { toError } from "./toError";

export type TimeoutCode = "ENQUEUE_TIMEOUT";

export class TimeoutError extends Error {
  constructor(
    readonly code: TimeoutCode,
    readonly timeoutMs: number,
  ) {
    super(`${code}: timed out after ${timeoutMs} ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Bounds a promise with a hard deadline. Rejects with a coded TimeoutError if
 * the deadline passes first. The inner work is NOT cancelled, so callers must
 * make late results harmless (e.g. the worker's guarded writes).
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  code: TimeoutCode,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new TimeoutError(code, timeoutMs)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(toError(error));
      },
    );
  });
