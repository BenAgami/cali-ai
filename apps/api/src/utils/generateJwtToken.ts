import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { Role } from "@repo/db";

interface SignedPayload {
  uuid: string;
  role: Role;
}

const generateJwtToken = (user: SignedPayload) => {
  return jwt.sign(
    {
      sub: user.uuid,
      role: user.role,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn },
  );
};

export default generateJwtToken;
