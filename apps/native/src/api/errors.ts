export class ApiError extends Error {
  public readonly name: string;
  public readonly status: number;
  public readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
