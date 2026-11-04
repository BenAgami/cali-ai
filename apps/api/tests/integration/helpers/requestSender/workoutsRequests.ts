import { Application } from "express";
import supertest from "supertest";

const withAuth = (req: supertest.Test, token?: string) => {
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req;
};

export const createWorkout = async (
  app: Application,
  token: string | undefined,
  data: object | string,
) =>
  withAuth(
    supertest
      .agent(app)
      .post("/api/workouts")
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
      .post("/api/workouts/generate")
      .set("Content-Type", "application/json"),
    token,
  ).send(body);

export const listWorkouts = async (
  app: Application,
  token: string | undefined,
  query?: Record<string, string | number | undefined>,
) => {
  const req = withAuth(supertest.agent(app).get("/api/workouts"), token);
  if (query) req.query(query);
  return req;
};

export const getWorkout = async (
  app: Application,
  token: string | undefined,
  id: number | string,
) => withAuth(supertest.agent(app).get(`/api/workouts/${id}`), token);

export const updateWorkout = async (
  app: Application,
  token: string | undefined,
  id: number | string,
  data: object | string,
) =>
  withAuth(
    supertest
      .agent(app)
      .patch(`/api/workouts/${id}`)
      .set("Content-Type", "application/json"),
    token,
  ).send(data);

export const deleteWorkout = async (
  app: Application,
  token: string | undefined,
  id: number | string,
) => withAuth(supertest.agent(app).delete(`/api/workouts/${id}`), token);

export const startWorkout = async (
  app: Application,
  token: string | undefined,
  id: number | string,
  data: object | string,
) =>
  withAuth(
    supertest
      .agent(app)
      .post(`/api/workouts/${id}/logs`)
      .set("Content-Type", "application/json"),
    token,
  ).send(data);
