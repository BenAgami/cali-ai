import type { Application } from "express";
import supertest from "supertest";

const withAuth = (req: supertest.Test, token?: string) => {
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req;
};

export const createWorkoutPlan = async (
  app: Application,
  token: string | undefined,
  data: object | string,
) =>
  withAuth(
    supertest
      .agent(app)
      .post("/api/workout-plans")
      .set("Content-Type", "application/json"),
    token,
  ).send(data);

export const postGenerateWorkout = async (
  app: Application,
  body: object,
  token?: string,
) =>
  withAuth(
    supertest
      .agent(app)
      .post("/api/workout-plans/generate")
      .set("Content-Type", "application/json"),
    token,
  ).send(body);

export const listWorkoutPlans = async (
  app: Application,
  token: string | undefined,
  query?: Record<string, string | number | undefined>,
) => {
  const req = withAuth(supertest.agent(app).get("/api/workout-plans"), token);
  if (query) req.query(query);
  return req;
};

export const getWorkoutPlan = async (
  app: Application,
  token: string | undefined,
  id: number | string,
) => withAuth(supertest.agent(app).get(`/api/workout-plans/${id}`), token);

export const updateWorkoutPlan = async (
  app: Application,
  token: string | undefined,
  id: number | string,
  data: object | string,
) =>
  withAuth(
    supertest
      .agent(app)
      .patch(`/api/workout-plans/${id}`)
      .set("Content-Type", "application/json"),
    token,
  ).send(data);

export const deleteWorkoutPlan = async (
  app: Application,
  token: string | undefined,
  id: number | string,
) => withAuth(supertest.agent(app).delete(`/api/workout-plans/${id}`), token);

export const startWorkout = async (
  app: Application,
  token: string | undefined,
  id: number | string,
) =>
  withAuth(supertest.agent(app).post(`/api/workout-plans/${id}/runs`), token);

export const completeWorkout = async (
  app: Application,
  token: string | undefined,
  id: number | string,
  runId: number | string,
  data: object | string,
) =>
  withAuth(
    supertest
      .agent(app)
      .patch(`/api/workout-plans/${id}/runs/${runId}`)
      .set("Content-Type", "application/json"),
    token,
  ).send(data);

export const getRecordedSets = async (
  app: Application,
  token: string | undefined,
  id: number | string,
  query: Record<string, number | string> = {},
) =>
  withAuth(
    supertest
      .agent(app)
      .get(`/api/workout-plans/${id}/recorded-sets`)
      .query(query),
    token,
  );
