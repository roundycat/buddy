/**
 * Domain-layer errors — services throw these; HTTP mapping stays in withApiGuard.
 * Keeps Controllers thin and Services free of NextResponse / status codes.
 */
export type DomainErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(message: string, code: DomainErrorCode = "VALIDATION") {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function domainStatus(error: DomainError): number {
  switch (error.code) {
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "FORBIDDEN":
      return 403;
    default:
      return 400;
  }
}
