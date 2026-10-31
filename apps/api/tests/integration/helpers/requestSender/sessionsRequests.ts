import { gzipSync } from "node:zlib";
import { Application } from "express";
import supertest from "supertest";

import type { PoseCapturePayload } from "@repo/common";

export const submitCapture = async (
  app: Application,
  token: string | undefined,
  sessionId: number | string,
  payload: PoseCapturePayload | Record<string, unknown>,
) => {
  const request = supertest
    .agent(app)
    .post(`/api/sessions/${sessionId}/capture`);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request
    .set("Content-Type", "application/gzip")
    .serialize(((body: Buffer) => body) as unknown as (obj: unknown) => string)
    .send(gzipSync(Buffer.from(JSON.stringify(payload))));
};

export const submitRawCapture = async (
  app: Application,
  token: string,
  sessionId: number | string,
  bytes: Buffer,
  contentType = "application/gzip",
) =>
  supertest
    .agent(app)
    .post(`/api/sessions/${sessionId}/capture`)
    .set("Authorization", `Bearer ${token}`)
    .set("Content-Type", contentType)
    .serialize(((body: Buffer) => body) as unknown as (obj: unknown) => string)
    .send(bytes);

export const retryAnalysis = async (
  app: Application,
  token: string | undefined,
  sessionId: number | string,
) => {
  const request = supertest
    .agent(app)
    .post(`/api/sessions/${sessionId}/analysis/retry`);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};

export const getAnalysisStatus = async (
  app: Application,
  token: string | undefined,
  sessionId: number | string,
) => {
  const request = supertest.agent(app).get(`/api/sessions/${sessionId}/status`);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};
