import { Application } from "express";
import supertest from "supertest";

import { CreateWorkoutSessionValues } from "@repo/common";

export const createWorkoutSession = async (
  app: Application,
  token: string | undefined,
  data: Partial<CreateWorkoutSessionValues>,
) => {
  const request = supertest
    .agent(app)
    .post("/api/sessions")
    .set("Content-Type", "application/json");

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request.send(data);
};

export const listWorkoutSessions = async (
  app: Application,
  token: string | undefined,
  query?: Record<string, string | number | undefined>,
) => {
  const request = supertest.agent(app).get("/api/sessions");

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  if (query) {
    request.query(query);
  }

  return request;
};
