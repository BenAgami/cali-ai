import { Router, Request, Response } from "express";
import helmet from "helmet";
import { apiReference } from "@scalar/express-api-reference";

const router = Router();

let specPromise: Promise<{ spec: unknown }> | undefined;
const getSpec = () => {
  specPromise ??= import("../openapi/spec");
  return specPromise;
};

router.get("/openapi.json", async (_req: Request, res: Response) => {
  const { spec } = await getSpec();
  res.json(spec);
});

router.use(
  "/docs",
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        "img-src": ["'self'", "data:", "https://cdn.jsdelivr.net"],
        "font-src": ["'self'", "data:", "https://cdn.jsdelivr.net"],
        "worker-src": ["'self'", "blob:"],
      },
    },
  }),
  apiReference({
    url: "/api/openapi.json",
    pageTitle: "Cali AI API Reference",
  }),
);

export default router;
