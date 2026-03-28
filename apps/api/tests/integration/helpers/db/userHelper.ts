import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { getPrismaClient, Role } from "@repo/db";

import generateJwtToken from "../../../../src/utils/generateJwtToken";

export const createAdminUserWithToken = async (
  prisma: ReturnType<typeof getPrismaClient>,
): Promise<{ token: string }> => {
  const suffix = randomUUID().split("-")[0];
  const hashedPassword = await bcrypt.hash("AdminPassword123!", 10);

  const user = await prisma.user.create({
    data: {
      email: `admin-${suffix}@example.com`,
      fullName: "Admin User",
      username: `admin_${suffix}`,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  const token = generateJwtToken({ uuid: user.uuid, role: user.role });

  return { token };
};
