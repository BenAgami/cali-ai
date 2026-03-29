import { Application } from "express";
import supertest from "supertest";

export const getUserByUuid = async (
  app: Application,
  userUuid: string | undefined,
  token?: string,
) => {
  const request = supertest(app).get(`/api/users/${userUuid}`);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};

export const getMyUser = async (app: Application, token?: string) => {
  const request = supertest(app).get(`/api/users/me`);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};
