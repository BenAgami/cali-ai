import { vi, type Mock } from "vitest";
import type { NextFunction, Request, Response } from "express";

export type MockResponse = Response & {
  status: Mock;
  json: Mock;
  send: Mock;
};

export const createMockResponse = (): MockResponse => {
  const res = {} as MockResponse;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

export const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    headers: {},
    body: {},
    query: {},
    params: {},
    method: "GET",
    originalUrl: "/api/test",
    ...overrides,
  }) as Request;

export const createMockNext = (): Mock & NextFunction => vi.fn();

/**
 * Reads the JSON body handed to `res.json`, typed as `unknown` so callers narrow
 * it deliberately rather than leaning on `any`.
 */
export const jsonBody = (res: MockResponse): unknown =>
  res.json.mock.calls[0]?.[0];
