import request from "supertest";
import { Application } from "express";
import { StatusCodes } from "http-status-codes";

import { createApp } from "../src/app";

describe("Health Check API", () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe("GET /api/health", () => {
    it("returns 200 and status ok", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body).toEqual({ status: "ok" });
    });
  });
});
