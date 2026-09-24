import { defineConfig, Options } from "tsup";

export default defineConfig((options: Options) => ({
  entry: {
    index: "src/index.ts",
  },
  format: ["cjs", "esm"],
  external: ["zod"],
  dts: true,
  ...options,
  clean: !options.watch,
}));
