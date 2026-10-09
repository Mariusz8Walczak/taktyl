// I-014: cienki klient REST API Taktyl dla serwerow MCP. Zadnej logiki biznesowej: buduje adres, wysyla zadanie, mapuje blad
// application/problem+json (docs/16 §1) na ApiError i opcjonalnie waliduje odpowiedz schematem z @taktyl/contracts.
// Ciasteczka (sesja backpanelu) trzyma sam klient, w pamieci procesu; nic nie jest zapisywane na dysku.
import type { z } from "zod";

export type QueryValue = string | number | boolean | undefined | null;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors: { path?: string; code?: string; message?: string }[] = [],
    readonly retryAfter?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Odpowiedz API niezgodna z kontraktem (schemat z @taktyl/contracts). */
export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export interface RequestOptions<T = unknown> {
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Schemat odpowiedzi 2xx; niezgodnosc = ContractError. */
  schema?: z.ZodType<T>;
}

export interface ApiResult<T> {
  status: number;
  data: T;
  headers: Headers;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Maksymalny rozmiar odpowiedzi w bajtach (domyslnie 5 MB). */
  maxResponseBytes?: number;
  /** Trzyma i odsyla ciasteczka z Set-Cookie (sesja backpanelu). */
  useCookies?: boolean;
  /** Dodatkowe naglowki zalezne od zadania (np. X-CSRF-Token przy mutacjach). */
  extraHeaders?: (method: string, path: string) => Record<string, string>;
  /**
   * Wywolywany po 401 i po 403 `csrf_invalid`; zwraca true, gdy mozna ponowic zadanie raz
   * (np. po ponownym zalogowaniu albo odswiezeniu tokenu CSRF).
   */
  onAuthFailure?: (error: ApiError, path: string) => Promise<boolean>;
}

export interface ApiClient {
  request<T = unknown>(
    method: string,
    path: string,
    options?: RequestOptions<T>,
  ): Promise<ApiResult<T>>;
  get<T = unknown>(path: string, options?: RequestOptions<T>): Promise<T>;
  readonly baseUrl: string;
  /** Wartosci ciasteczek trzymanych w pamieci (do maskowania w wynikach); puste bez useCookies. */
  cookieValues(): string[];
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const url = new URL(path.replace(/^\/+/, ""), baseUrl.replace(/\/+$/, "") + "/");
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

function parseSetCookie(headers: Headers): [string, string][] {
  const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const out: [string, string][] = [];
  for (const line of raw) {
    const first = line.split(";", 1)[0] ?? "";
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    out.push([first.slice(0, eq).trim(), first.slice(eq + 1).trim()]);
  }
  return out;
}

async function readLimited(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes)
    throw new ApiError(502, "response_too_large", "Odpowiedz API jest za duza.");
  const text = await res.text();
  if (Buffer.byteLength(text) > maxBytes) {
    throw new ApiError(502, "response_too_large", "Odpowiedz API jest za duza.");
  }
  return text;
}

function toApiError(res: Response, text: string): ApiError {
  let code = "http_error";
  let message = `HTTP ${res.status}`;
  let errors: { path?: string; code?: string; message?: string }[] = [];
  try {
    const p = JSON.parse(text) as {
      code?: string;
      detail?: string;
      title?: string;
      errors?: { path?: string; code?: string; message?: string }[];
    };
    if (typeof p.code === "string") code = p.code;
    message = p.detail ?? p.title ?? message;
    if (Array.isArray(p.errors)) errors = p.errors.slice(0, 20);
  } catch {
    // ciało nie jest JSON-em: zostaje kod HTTP
  }
  return new ApiError(
    res.status,
    code,
    message,
    errors,
    res.headers.get("retry-after") ?? undefined,
  );
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;
  const jar = new Map<string, string>();
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_BYTES;

  async function once<T>(
    method: string,
    path: string,
    o: RequestOptions<T>,
  ): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...(options.extraHeaders?.(method, path) ?? {}),
      ...(o.headers ?? {}),
    };
    if (o.body !== undefined) headers["content-type"] = "application/json";
    if (options.useCookies && jar.size > 0) {
      headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    let res: Response;
    try {
      res = await doFetch(buildUrl(options.baseUrl, path, o.query), {
        method,
        headers,
        ...(o.body === undefined ? {} : { body: JSON.stringify(o.body) }),
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (cause) {
      const timeout = cause instanceof DOMException && cause.name === "TimeoutError";
      throw new ApiError(
        504,
        timeout ? "timeout" : "network",
        timeout ? "API nie odpowiedzialo w limicie czasu." : "Nie mozna polaczyc sie z API.",
      );
    }
    if (options.useCookies) {
      for (const [k, v] of parseSetCookie(res.headers)) {
        if (v === "" || v === "deleted") jar.delete(k);
        else jar.set(k, v);
      }
    }
    const text = await readLimited(res, maxBytes);
    if (!res.ok) throw toApiError(res, text);
    let data: unknown = null;
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(502, "invalid_json", "API zwrocilo niepoprawny JSON.");
      }
    }
    if (o.schema) {
      const parsed = o.schema.safeParse(data);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new ContractError(
          `Odpowiedz API niezgodna z kontraktem (${issue?.path.join(".") || "korzen"}: ${issue?.message ?? "blad"}).`,
        );
      }
      data = parsed.data;
    }
    return { status: res.status, data: data as T, headers: res.headers };
  }

  async function request<T>(
    method: string,
    path: string,
    o: RequestOptions<T> = {},
  ): Promise<ApiResult<T>> {
    try {
      return await once<T>(method, path, o);
    } catch (error) {
      const retryable =
        error instanceof ApiError &&
        (error.status === 401 || (error.status === 403 && error.code === "csrf_invalid"));
      if (retryable && options.onAuthFailure && (await options.onAuthFailure(error, path))) {
        return once<T>(method, path, o);
      }
      throw error;
    }
  }

  return {
    baseUrl: options.baseUrl,
    cookieValues: () => [...jar.values()],
    request,
    async get<T>(path: string, o?: RequestOptions<T>) {
      return (await request<T>("GET", path, o)).data;
    },
  };
}
