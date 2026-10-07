// B-001, B-002, B-003 (ADM-001): cienka warstwa klienta API. Zapytania ida na ten sam adres (/v1/...), a route handler
// `app/v1/[...path]` przekazuje je do API (ciasteczko sesji HttpOnly nigdy nie jest widoczne w JS).
// Odpowiedzi sa parsowane schematami z @taktyl/contracts, bledy to RFC 9457 (problem+json).
import { problemSchema, type Problem, type ProblemFieldError } from "@taktyl/contracts";
import type { z } from "zod";

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem | null;
  readonly retryAfterSeconds: number | null;
  constructor(status: number, problem: Problem | null, retryAfterSeconds: number | null = null) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.retryAfterSeconds = retryAfterSeconds;
  }
  get code(): string | null {
    return this.problem?.code ?? null;
  }
  /** Blad pol z walidacji (422): sciezka -> komunikat. */
  get fieldErrors(): ProblemFieldError[] {
    return this.problem?.errors ?? [];
  }
  /** B-002: 401 z kodem `session_expired` lub `no_session`. */
  get sessionCode(): string | null {
    return this.status === 401 ? (this.problem?.errors?.[0]?.code ?? "no_session") : null;
  }
}

/** Blad odpowiedzi niezgodnej z kontraktem (zly schemat) - nie jest problemem uzytkownika. */
export class ContractError extends Error {
  constructor(
    readonly path: string,
    readonly issues: string,
  ) {
    super(`Odpowiedz ${path} niezgodna z kontraktem: ${issues}`);
    this.name = "ContractError";
  }
}

let csrfToken: string | null = null;
/** Token CSRF z /auth/me trzymany tylko w pamieci modulu (nie w storage). */
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}
export function getCsrfToken(): string | null {
  return csrfToken;
}

export const UNAUTHORIZED_EVENT = "taktyl:unauthorized";

export interface RequestOptions<S extends z.ZodType | null> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Schemat odpowiedzi; null = brak ciala (204). */
  schema: S;
  /** B-103/ADR API-011: wersja encji do If-Match. */
  ifMatch?: number;
  signal?: AbortSignal;
}

export interface ApiResult<T> {
  data: T;
  /** ETag jako liczba (wersja), jesli API go zwrocilo. */
  version: number | null;
}

export function buildUrl(path: string, query?: RequestOptions<null>["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function parseEtag(value: string | null): number | null {
  const m = value?.match(/^(?:W\/)?"(\d+)"$/);
  return m ? Number(m[1]) : null;
}

export async function apiRequest<S extends z.ZodType | null>(
  opts: RequestOptions<S>,
): Promise<ApiResult<S extends z.ZodType ? z.output<S> : null>> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  if (opts.ifMatch !== undefined) headers["If-Match"] = `"${opts.ifMatch}"`;

  const res = await fetch(buildUrl(opts.path, opts.query), {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: "include",
    cache: "no-store",
    signal: opts.signal,
  });

  if (!res.ok) {
    const problem = await res
      .json()
      .then((body: unknown) => {
        const parsed = problemSchema.safeParse(body);
        return parsed.success ? parsed.data : null;
      })
      .catch(() => null);
    const retry = Number(res.headers.get("Retry-After"));
    const err = new ApiError(
      res.status,
      problem,
      Number.isFinite(retry) && retry > 0 ? retry : null,
    );
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      opts.path !== "/v1/admin/auth/login"
    ) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: err.sessionCode }));
    }
    throw err;
  }

  const version = parseEtag(res.headers.get("ETag"));
  if (opts.schema === null || res.status === 204) {
    return { data: null as never, version };
  }
  const json: unknown = await res.json();
  const parsed = (opts.schema as z.ZodType).safeParse(json);
  if (!parsed.success) {
    throw new ContractError(
      opts.path,
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  return { data: parsed.data as never, version };
}
