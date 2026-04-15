export class AppHttpError extends Error {
  public readonly errorCode: string;

  public readonly statusCode: number;

  public constructor(errorCode: string, message: string, statusCode: number) {
    super(message);
    this.name = 'AppHttpError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}

export function createError(
  errorCode: string,
  message: string,
  statusCode: number
): never {
  throw new AppHttpError(errorCode, message, statusCode);
}
