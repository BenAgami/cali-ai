import type { Application } from "express";
import supertest from "supertest";

import type {
  LoginValues,
  RegisterValues,
  RefreshTokenValues,
  LogoutValues,
} from "@repo/common";

export const registerUser = async (
  app: Application,
  userRegisterData: Partial<RegisterValues>,
) => {
  return supertest
    .agent(app)
    .post("/api/auth/register")
    .set("Content-Type", "application/json")
    .send(userRegisterData);
};

export const loginUser = async (
  app: Application,
  userLoginData: Partial<LoginValues>,
) => {
  return supertest
    .agent(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send(userLoginData);
};

export const refreshToken = async (
  app: Application,
  refreshTokenValue: RefreshTokenValues["refreshToken"],
) => {
  return supertest
    .agent(app)
    .post("/api/auth/refresh")
    .set("Content-Type", "application/json")
    .send({ refreshToken: refreshTokenValue });
};

export const logoutUser = async (
  app: Application,
  refreshTokenValue: LogoutValues["refreshToken"],
) => {
  return supertest
    .agent(app)
    .post("/api/auth/logout")
    .set("Content-Type", "application/json")
    .send({ refreshToken: refreshTokenValue });
};
