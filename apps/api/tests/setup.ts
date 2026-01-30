const setup = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Setup aborted: NODE_ENV is not 'test'");
  }

  if (!process.env.DATABASE_URL?.includes("_test")) {
    throw new Error(
      "Setup aborted: DATABASE_URL does not contain '_test'. Dangerous operation averted!"
    );
  }
};

setup();
