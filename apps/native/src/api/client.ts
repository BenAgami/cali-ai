import StatusCode from "http-status-codes";

import { tokenStore } from "./tokenStore";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!API_BASE) throw new Error("EXPO_PUBLIC_API_BASE_URL is not set in .env");

const TIMEOUT_MS = 10_000;

const FALLBACK_MESSAGES: Partial<Record<number, string>> = {
  [StatusCode.BAD_REQUEST]: "Invalid request.",
  [StatusCode.UNAUTHORIZED]: "Session expired. Please log in again.",
  [StatusCode.FORBIDDEN]: "You don't have permission to do that.",
  [StatusCode.NOT_FOUND]: "Not found.",
  [StatusCode.UNPROCESSABLE_ENTITY]: "Invalid data submitted.",
};

export class ApiError extends Error {
  public readonly name: string;
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
  withAuth: boolean,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };

    if (withAuth) {
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
  const json = await parseJson(res);
  if (!res.ok || !json.success) {
    throw new ApiError(
      res.status,
      resolveMessage(res.status, json.message as string | undefined),
    );
  }
  return json.data as T;
};

const tryRefreshAndRetry = async <T>(
  path: string,
  init: RequestInit,
): Promise<T> => {
  const refreshToken = await tokenStore.getRefreshToken();
  if (refreshToken) {
    try {
      const refreshRes = await sendRequest(
        "/api/users/refresh",
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
          const retryRes = await sendRequest(path, init, true);
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

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const res = await sendRequest(path, init, true);
  if (res.status === StatusCode.UNAUTHORIZED) {
    return tryRefreshAndRetry<T>(path, init);
  }
  return parseResponse<T>(res);
};

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
