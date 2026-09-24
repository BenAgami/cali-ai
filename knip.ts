import type { KnipConfig } from "knip";

process.env.DATABASE_URL ??= "postgresql://knip:knip@localhost:5432/knip";

const config: KnipConfig = {
  ignoreDependencies: ["expo-updates"],
  ignore: [".claude/**"],
  ignoreExportsUsedInFile: { interface: true, type: true },
  workspaces: {
    "apps/api": {
      ignoreDependencies: ["pino-pretty"],
    },
    "packages/database": {
      ignoreDependencies: ["@prisma/client"],
    },
  },
};

export default config;
