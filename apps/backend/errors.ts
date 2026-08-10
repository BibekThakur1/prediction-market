export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function assertFound<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new ApiError(404, "NOT_FOUND", message);
  return value;
}
