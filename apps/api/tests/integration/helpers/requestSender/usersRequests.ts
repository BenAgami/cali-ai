import { Application } from "express";
import supertest from "supertest";

export const getUserByUuid = async (
  app: Application,
  userUuid: string | undefined,
) => {
  return supertest(app)
    .get(`/api/users/${userUuid}`);
};
