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

export const patchMyProfile = async (
  app: Application,
  body: Record<string, unknown>,
  token?: string,
) => {
  const request = supertest(app).patch("/api/users/me").send(body);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};

export const postAvatarUploadUrl = async (app: Application, token?: string) => {
  const request = supertest(app).post("/api/users/me/avatar-upload-url");

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};

export const postMyGoal = async (
  app: Application,
  body: Record<string, unknown>,
  token?: string,
) => {
  const request = supertest(app).post("/api/users/me/goals").send(body);

  if (token) {
    request.set("Authorization", `Bearer ${token}`);
  }

  return request;
};
