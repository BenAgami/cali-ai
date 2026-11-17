import type { Application } from "express";
import supertest from "supertest";

export const createRecordedSet = async (
  app: Application,
  token: string | undefined,
  data: object,
) => {
  const request = supertest
    .agent(app)
    .post("/api/recorded-sets")
    .set("Content-Type", "application/json");

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request.send(data);
};

export const listRecordedSets = async (
  app: Application,
  token: string | undefined,
  query?: Record<string, string | number | undefined>,
) => {
  const request = supertest.agent(app).get("/api/recorded-sets");

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  if (query) {
    request.query(query);
  }

  return request;
};
