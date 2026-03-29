import { Application } from "express";
import supertest from "supertest";

export const listExercises = async (
  app: Application,
  query?: Record<string, string | number | boolean | undefined>,
  token?: string,
) => {
  const request = supertest.agent(app).get("/api/exercises");

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  if (query) {
    request.query(query);
  }

  return request;
};

export const getExerciseByCode = async (
  app: Application,
  code: string | undefined,
) => {
  return supertest.agent(app).get(`/api/exercises/${code}`);
};
