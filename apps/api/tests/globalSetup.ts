import { execSync } from "node:child_process";
import path from "node:path";

export default async function globalSetup() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("globalSetup aborted: NODE_ENV is not 'test'");
  }

  if (!process.env.DATABASE_URL?.includes("_test")) {
    throw new Error(
      "globalSetup aborted: DATABASE_URL does not point to a test database"
    );
  }

  console.log("Resetting test database...");

  try {
    const databaseDir = path.resolve(__dirname, "../../../packages/database");
    execSync(`yarn --cwd ${databaseDir} db:migrate:reset`, {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "test" },
    });
  } catch (error) {
    console.error("Failed to reset test database", error);
    throw error;
  }

  console.log("Test database reset complete");
}
