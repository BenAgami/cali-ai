import { randomUUID } from "crypto";

import { RegisterUserDto } from "./registerUserBuilder";

export interface LoginUserDto {
  email?: string;
  password?: string;
}

export class LoginUserBuilder {
  private user: LoginUserDto;

  constructor() {
    const suffix = randomUUID().split("-")[0];
    this.user = {
      email: `test-${suffix}@example.com`,
      password: "SecurePassword123!",
    };
  }

  fromRegisterDto(registerDto: RegisterUserDto) {
    this.user.email = registerDto.email;
    this.user.password = registerDto.password;
    return this;
  }

  setEmail(email?: string): LoginUserBuilder {
    this.user.email = email;
    return this;
  }

  setPassword(password?: string): LoginUserBuilder {
    this.user.password = password;
    return this;
  }

  build(): LoginUserDto {
    return { ...this.user };
  }
}
