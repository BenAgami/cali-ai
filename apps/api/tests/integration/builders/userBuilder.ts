import { randomUUID } from "crypto";

export interface RegisterUserDto {
  email?: string;
  password?: string;
  name?: string;
}

export class UserBuilder {
  private user: RegisterUserDto;

  constructor() {
    this.user = {
      email: `test-${randomUUID()}@example.com`,
      password: "SecurePassword123!",
      name: "Test User",
    };
  }

  setEmail(email?: string): UserBuilder {
    this.user.email = email;
    return this;
  }

  setPassword(password?: string): UserBuilder {
    this.user.password = password;
    return this;
  }

  setName(name?: string): UserBuilder {
    this.user.name = name;
    return this;
  }

  build(): RegisterUserDto {
    return { ...this.user };
  }
}
