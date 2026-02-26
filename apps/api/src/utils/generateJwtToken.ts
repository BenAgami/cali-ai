import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface SignedPayload {
  uuid: string;
  role: "admin" | "user";
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
