import { defineConfig, Options } from "tsup";

export default defineConfig((options: Options) => ({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  external: ["@prisma/client", "@prisma/adapter-pg", ".prisma/client"],
  dts: true,
  splitting: false,
  sourcemap: false,
  shims: true,
  clean: true,
  ...options,
}));
