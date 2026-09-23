const safeStringify = (value: object): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
};

export const toError = (value: unknown): Error => {
  if (value instanceof Error) return value;

  if (value && typeof value === "object") {
    const message =
      "message" in value && typeof value.message === "string"
        ? value.message
        : safeStringify(value);

    const err = new Error(message);
    Object.assign(err, value);
    err.message = message;
    return err;
  }

  return new Error(String(value));
};
