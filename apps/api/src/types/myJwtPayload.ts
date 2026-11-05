import type { JwtPayload } from "jsonwebtoken";
import type { Role } from "@repo/db";

interface MyJwtPayload extends JwtPayload {
  role: Role;
}

export default MyJwtPayload;
