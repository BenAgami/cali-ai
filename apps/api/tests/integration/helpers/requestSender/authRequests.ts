import { Application } from "express";
import supertest from "supertest";

import { LoginValues, RegisterValues } from "@repo/common";

export const registerUser = async (
  app: Application,
  userRegisterData: Partial<RegisterValues>,
) => {
  return supertest
    .agent(app)
    .post("/api/users/register")
    .set("Content-Type", "application/json")
    .send(userRegisterData);
};

export const loginUser = async (
  app: Application,
  userLoginData: Partial<LoginValues>,
) => {
  return supertest
    .agent(app)
    .post("/api/users/login")
    .set("Content-Type", "application/json")
    .send(userLoginData);
};
