import { gzipSync } from "node:zlib";
import type { Application } from "express";
import supertest from "supertest";

import type { PoseCapturePayload } from "@repo/common";

export const submitCapture = async (
  app: Application,
  token: string | undefined,
  recordedSetId: number | string,
  payload: PoseCapturePayload | Record<string, unknown>,
) => {
  const request = supertest
    .agent(app)
    .post(`/api/recorded-sets/${recordedSetId}/capture`);

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
  recordedSetId: number | string,
  bytes: Buffer,
  contentType = "application/gzip",
) =>
  supertest
    .agent(app)
    .post(`/api/recorded-sets/${recordedSetId}/capture`)
    .set("Authorization", `Bearer ${token}`)
    .set("Content-Type", contentType)
    .serialize(((body: Buffer) => body) as unknown as (obj: unknown) => string)
    .send(bytes);

export const retryAnalysis = async (
  app: Application,
  token: string | undefined,
  recordedSetId: number | string,
) => {
  const request = supertest
    .agent(app)
    .post(`/api/recorded-sets/${recordedSetId}/analysis/retry`);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};

export const getAnalysisStatus = async (
  app: Application,
  token: string | undefined,
  recordedSetId: number | string,
) => {
  const request = supertest
    .agent(app)
    .get(`/api/recorded-sets/${recordedSetId}/status`);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};

export const getRecordedSetAnalysis = async (
  app: Application,
  token: string | undefined,
  recordedSetId: number | string,
) => {
  const request = supertest
    .agent(app)
    .get(`/api/recorded-sets/${recordedSetId}/analysis`);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};
