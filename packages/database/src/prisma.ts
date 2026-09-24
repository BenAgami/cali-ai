import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
};

let prisma!: PrismaClient;

export const connectPrisma = async (
  connectionString: string,
  isProduction: boolean = false,
) => {
  if (globalForPrisma.prisma) {
    prisma = globalForPrisma.prisma;
    return;
  }

  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter, log: ["error", "warn"] });

  await client.$connect();

  prisma = client;
  if (!isProduction) {
    globalForPrisma.prisma = client;
  }
};

export const disconnectPrisma = async () => {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    delete globalForPrisma.prisma;
    console.log("Prisma disconnected");
  } else if (prisma) {
    await prisma.$disconnect();
    console.log("Prisma disconnected");
  }
};

export const getPrismaClient = () => {
  if (!prisma) {
    throw new Error("Prisma client not initialized. Call connectPrisma first.");
  }
  return prisma;
};
