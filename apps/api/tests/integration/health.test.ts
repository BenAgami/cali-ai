import request from "supertest";
import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { getPrismaClient } from "@repo/db";

import {
  setupIntegrationTest,
  teardownIntegrationTest,
} from "./helpers/testSetup";

describe("Health Check API", () => {
  let app: Application;
  let prisma: ReturnType<typeof getPrismaClient>;

  beforeAll(async () => {
    ({ app, prisma } = await setupIntegrationTest());
  });

  afterAll(async () => {
    await teardownIntegrationTest(prisma);
  });

  describe("GET /api/health", () => {
    it("returns 200 and status ok with db ok", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body).toEqual({ status: "ok", db: "ok" });
    });
  });
});
