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

  console.log("Applying test database migrations...");

  try {
    const databaseDir = path.resolve(__dirname, "../../../packages/database");
    execSync(`yarn --cwd ${databaseDir} db:migrate:deploy`, {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "test" },
    });
  } catch (error) {
    console.error("Failed to apply test database migrations", error);
    throw error;
  }

  console.log("Test database migrations applied");
}
