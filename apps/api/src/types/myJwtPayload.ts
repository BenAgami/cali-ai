import { JwtPayload } from "jsonwebtoken";
import { Role } from "@repo/db";

interface MyJwtPayload extends JwtPayload {
  role: Role;
}

export default MyJwtPayload;
