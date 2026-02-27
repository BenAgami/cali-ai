import { randomUUID } from "crypto";

export interface RegisterUserDto {
  email?: string;
  password?: string;
  name?: string;
}

export class RegisterUserBuilder {
  private user: RegisterUserDto;

  constructor() {
    this.user = {
      email: `test-${randomUUID()}@example.com`,
      password: "SecurePassword123!",
      name: "Test User",
    };
  }

  setEmail(email?: string): RegisterUserBuilder {
    this.user.email = email;
    return this;
  }

  setPassword(password?: string): RegisterUserBuilder {
    this.user.password = password;
    return this;
  }

  setName(name?: string): RegisterUserBuilder {
    this.user.name = name;
    return this;
  }

  build(): RegisterUserDto {
    return { ...this.user };
  }
}
