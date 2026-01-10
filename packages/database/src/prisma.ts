import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
};

export let prisma!: PrismaClient;

export async function connectPrisma(connectionString: string) {
  if (globalForPrisma.prisma) {
    prisma = globalForPrisma.prisma;
    return;
  }

  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter, log: ["error", "warn"] });

  await client.$connect();

  prisma = client;
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
}

export async function disconnectPrisma() {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    delete globalForPrisma.prisma;
    // eslint-disable-next-line no-console
    console.log("Prisma disconnected");
  } else if (prisma) {
    await prisma.$disconnect();
    // eslint-disable-next-line no-console
    console.log("Prisma disconnected");
  }
}

process.on("SIGINT", () => disconnectPrisma());
process.on("SIGTERM", () => disconnectPrisma());
