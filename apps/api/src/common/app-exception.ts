// B-210 (docs/16 par. 1): wyjatek aplikacyjny niosacy kod bledu z kontraktu (problem+json, RFC 9457).
import type { ErrorCode, ProblemFieldError } from "@taktyl/contracts";

export class AppException extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly detail?: string,
    readonly errors?: ProblemFieldError[],
  ) {
    super(detail ?? code);
  }
}

export const notFound = (detail?: string): AppException =>
  new AppException(404, "not_found", detail);
export const unauthorized = (detail?: string): AppException =>
  new AppException(401, "unauthorized", detail);
export const validationFailed = (
  errors: ProblemFieldError[],
  status = 422,
  detail = "Dane wejsciowe nie spelniaja kontraktu.",
): AppException => new AppException(status, "validation_failed", detail, errors);
