import { Application } from "express";
import supertest from "supertest";

import { RegisterValues } from "@repo/common";

export const registerUser = async (
  app: Application,
  userData: Partial<RegisterValues>,
) => {
  return supertest
    .agent(app)
    .post("/api/users/register")
    .set("Content-Type", "application/json")
    .send(userData);
};
