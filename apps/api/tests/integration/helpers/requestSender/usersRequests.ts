import { Application } from "express";
import supertest from "supertest";

export const getUserByUuid = async (
  app: Application,
  userUuid: string | undefined,
) => {
  return supertest(app).get(`/api/users/${userUuid}`);
};

export const getMyUser = async (app: Application, token: string) => {
  return supertest(app).get(`/api/me`).set("Authorization", `Bearer ${token}`);
};
