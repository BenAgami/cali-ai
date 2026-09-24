import type { getPrismaClient } from "@repo/db";

import { NotFoundError } from "../errors";

type PrismaClient = ReturnType<typeof getPrismaClient>;

export const getUserIdByUuid = async (
  prisma: PrismaClient,
  uuid: string,
): Promise<number> => {
  const user = await prisma.user.findUnique({
    where: { uuid },
    select: { id: true },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user.id;
};
