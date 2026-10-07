// B-210 (docs/16 par. 1): globalny filtr wyjatkow -> application/problem+json (RFC 9457), instance = X-Request-Id.
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import { PROBLEM_CONTENT_TYPE, type ErrorCode, type Problem } from "@taktyl/contracts";
import type { Response } from "express";
import type { Logger } from "pino";
import { AppException } from "./app-exception.js";
import type { RequestWithId } from "./request-context.js";

const TITLES: Record<ErrorCode, string> = {
  validation_failed: "Niepoprawne dane",
  unauthorized: "Brak uwierzytelnienia",
  forbidden: "Brak uprawnien",
  csrf_invalid: "Niepoprawny token CSRF",
  not_found: "Nie znaleziono",
  conflict: "Konflikt",
  out_of_stock: "Brak towaru",
  price_changed: "Zmiana ceny",
  rate_limited: "Za duzo zadan",
  idempotency_conflict: "Konflikt klucza idempotencji",
  invalid_transition: "Niedozwolone przejscie statusu",
  unsupported_media_type: "Nieobslugiwany typ pliku",
  payload_too_large: "Plik jest za duzy",
  internal_error: "Blad serwera",
};

function codeForStatus(status: number): ErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 413) return "payload_too_large";
  if (status === 415) return "unsupported_media_type";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "internal_error";
  return "validation_failed";
}

export function buildProblem(
  status: number,
  code: ErrorCode,
  instance: string | undefined,
  detail?: string,
  errors?: Problem["errors"],
): Problem {
  return {
    type: `https://taktyl.example/problems/${code.replaceAll("_", "-")}`,
    title: TITLES[code],
    status,
    code,
    ...(detail === undefined ? {} : { detail }),
    ...(instance === undefined ? {} : { instance }),
    ...(errors === undefined || errors.length === 0 ? {} : { errors }),
  };
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();
    const instance = req.id;
    let problem: Problem;
    if (exception instanceof AppException && exception.headers) {
      for (const [k, v] of Object.entries(exception.headers)) res.setHeader(k, v);
    }

    if (exception instanceof AppException) {
      problem = buildProblem(
        exception.status,
        exception.code,
        instance,
        exception.detail,
        exception.errors,
      );
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      problem = buildProblem(status, codeForStatus(status), instance);
    } else if (isHttpError(exception)) {
      // m.in. blad parsowania JSON z body-parsera (status 400) i zbyt duze cialo (413).
      problem = buildProblem(exception.status, codeForStatus(exception.status), instance);
    } else {
      this.logger.error(
        {
          requestId: instance,
          err:
            exception instanceof Error
              ? { name: exception.name, message: exception.message, stack: exception.stack }
              : "nieznany blad",
        },
        "unhandled",
      );
      problem = buildProblem(500, "internal_error", instance);
    }
    if (problem.status === 403 || problem.status === 401) {
      this.logger.warn(
        { requestId: instance, route: req.path, status: problem.status },
        "odmowa dostepu",
      );
    }
    res
      .status(problem.status)
      .setHeader("Content-Type", PROBLEM_CONTENT_TYPE)
      .send(JSON.stringify(problem));
  }
}

function isHttpError(e: unknown): e is { status: number } {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as { status?: unknown }).status === "number" &&
    (e as { status: number }).status >= 400 &&
    (e as { status: number }).status < 600
  );
}
