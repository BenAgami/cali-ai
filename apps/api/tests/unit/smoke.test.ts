import { env } from "../../src/config/env";

describe("unit project bootstrap", () => {
  it("imports src/config/env without a .env file or a live database", () => {
    expect(env.runtimeEnv).toBe("test");
  });
});
