import { Application } from "express";
import supertest from "supertest";

export const listExercises = async (
  app: Application,
  query?: Record<string, string | number | boolean | undefined>,
) => {
  const request = supertest.agent(app).get("/api/exercises");

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
