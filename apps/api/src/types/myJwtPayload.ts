import { JwtPayload } from "jsonwebtoken";

interface MyJwtPayload extends JwtPayload {
  role: "admin" | "user";
}

export default MyJwtPayload;
