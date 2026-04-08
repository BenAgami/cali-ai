export const API_BASE = "http://10.0.2.2:3000";

const STATUS_MESSAGES: Partial<Record<number, string>> = {
  400: "Invalid request.",
  401: "Session expired. Please log in again.",
  403: "You don't have permission to do that.",
  404: "Not found.",
  409: "That value is already taken.",
  422: "Invalid data submitted.",
};

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function safeMessage(status: number): string {
  return STATUS_MESSAGES[status] ?? "Something went wrong. Please try again.";
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers: extraHeaders, ...init } = options;

  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (init.body && typeof init.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    throw new ApiError(res.status, safeMessage(res.status));
  }

  const json = await res.json();
  if (!json.success) {
    throw new ApiError(res.status, safeMessage(res.status));
  }

  return json.data as T;
}

export const apiClient = {
  get: <T>(path: string, token?: string) =>
    request<T>(path, { method: "GET", token }),

  post: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body), token }),

  patch: <T>(path: string, body: unknown, token?: string) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body), token }),
};
