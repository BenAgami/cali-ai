import StatusCode from "http-status-codes";
import { gzipSync, strToU8 } from "fflate";

import { tokenStore } from "./tokenStore";
import { ApiError } from "./errors";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined;
if (!API_BASE) throw new Error("EXPO_PUBLIC_API_BASE_URL is not set in .env");

export const buildApiUrl = (path: string): string => `${API_BASE}${path}`;

const TIMEOUT_MS = 10_000;

const FALLBACK_MESSAGES: Partial<Record<number, string>> = {
  [StatusCode.BAD_REQUEST]: "Invalid request.",
  [StatusCode.UNAUTHORIZED]: "Session expired. Please log in again.",
  [StatusCode.FORBIDDEN]: "You don't have permission to do that.",
  [StatusCode.NOT_FOUND]: "Not found.",
  [StatusCode.UNPROCESSABLE_ENTITY]: "Invalid data submitted.",
};

let onUnauthenticated: (() => void) | null = null;

export const registerUnauthenticatedHandler = (fn: () => void) => {
  onUnauthenticated = fn;
};

const resolveMessage = (status: number, backendMessage?: string): string =>
  backendMessage ??
  FALLBACK_MESSAGES[status] ??
  "Something went wrong. Please try again.";

const parseJson = async (res: Response): Promise<Record<string, unknown>> => {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(res.status, "Unexpected response format.");
  }
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new ApiError(res.status, "Unexpected response format.");
  }
};

const sendRequest = async (
  path: string,
  init: RequestInit,
  shouldAttachAuth: boolean,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };

    if (shouldAttachAuth) {
      const token = await tokenStore.getAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    if (init.body && typeof init.body === "string") {
      headers["Content-Type"] = "application/json";
    }

    return await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, "Request timed out. Please try again.");
    }
    throw new ApiError(0, "Network error. Please check your connection.");
  } finally {
    clearTimeout(timer);
  }
};

const parseResponse = async <T>(res: Response): Promise<T> => {
  if (res.status === StatusCode.NO_CONTENT) {
    return undefined as unknown as T;
  }
  const json = await parseJson(res);
  if (!res.ok || !json.success) {
    throw new ApiError(
      res.status,
      resolveMessage(res.status, json.message as string | undefined),
      typeof json.code === "string" ? json.code : undefined,
    );
  }
  return json.data as T;
};

const tryRefreshAndRetry = async <T>(
  path: string,
  init: RequestInit,
  timeoutMs?: number,
): Promise<T> => {
  const refreshToken = await tokenStore.getRefreshToken();
  if (refreshToken) {
    try {
      const refreshRes = await sendRequest(
        "/api/auth/refresh",
        { method: "POST", body: JSON.stringify({ refreshToken }) },
        false,
      );
      if (refreshRes.ok) {
        const refreshJson = (await refreshRes.json()) as Record<
          string,
          unknown
        >;
        const data = refreshJson?.data as Record<string, unknown> | undefined;
        if (typeof data?.token === "string") {
          await tokenStore.setTokens(
            data.token,
            typeof data.refreshToken === "string"
              ? data.refreshToken
              : undefined,
          );

          const retryRes = await sendRequest(path, init, true, timeoutMs);
          return parseResponse<T>(retryRes);
        }
      }
    } catch {
      // refresh failed — fall through
    }
  }

  await tokenStore.clearTokens();
  onUnauthenticated?.();
  throw new ApiError(
    StatusCode.UNAUTHORIZED,
    resolveMessage(StatusCode.UNAUTHORIZED),
  );
};

type RequestOptions = { timeoutMs?: number };

const request = async <T>(
  path: string,
  init: RequestInit,
  options?: RequestOptions,
): Promise<T> => {
  const res = await sendRequest(path, init, true, options?.timeoutMs);
  if (res.status === StatusCode.UNAUTHORIZED) {
    return tryRefreshAndRetry<T>(path, init, options?.timeoutMs);
  }
  return parseResponse<T>(res);
};

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),

  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, options),

  postGzipJson: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      body: gzipSync(strToU8(JSON.stringify(body))),
      headers: { "Content-Type": "application/gzip" },
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
