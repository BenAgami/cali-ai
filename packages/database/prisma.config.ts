import { defineConfig, env } from "prisma/config";
import { config } from "dotenv";

const nodeEnv = process.env.NODE_ENV || "test";
config({ path: `.env.${nodeEnv}` });

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env<Env>("DATABASE_URL"),
  },
});
