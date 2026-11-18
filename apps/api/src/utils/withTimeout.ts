import { toError } from "./toError";

export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Timed out after ${timeoutMs} ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Bounds a promise with a hard deadline. Rejects with a TimeoutError if
 * the deadline passes first. The inner work is NOT cancelled, so callers must
 * make late results harmless (e.g. the worker's guarded writes).
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new TimeoutError(timeoutMs)),
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
