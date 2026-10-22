import { gzipSync } from "node:zlib";
import { Application } from "express";
import supertest from "supertest";

import type { PoseCapturePayload } from "@repo/common";

export const submitCapture = async (
  app: Application,
  token: string | undefined,
  sessionId: number | string,
  payload: PoseCapturePayload | Record<string, unknown>,
  { gzip = true }: { gzip?: boolean } = {},
) => {
  const request = supertest
    .agent(app)
    .post(`/api/sessions/${sessionId}/capture`);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  if (gzip) {
    return (
      request
        .set("Content-Type", "application/json")
        .set("Content-Encoding", "gzip")
        // superagent would JSON.stringify a Buffer body; send the bytes as-is.
        .serialize(
          ((body: Buffer) => body) as unknown as (obj: unknown) => string,
        )
        .send(gzipSync(Buffer.from(JSON.stringify(payload))))
    );
  }

  return request.send(payload);
};

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
