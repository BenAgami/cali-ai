import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface JwtPayload {
  id: string;
  role: string;
}

const generateJwtToken = (user: JwtPayload) => {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn },
  );
};

export default generateJwtToken;
