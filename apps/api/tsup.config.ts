import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { dependencies?: Record<string, string> };

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node24",
  outDir: "dist",
  splitting: true,
  clean: true,
  sourcemap: true,
  external: Object.keys(pkg.dependencies ?? {}),
});
