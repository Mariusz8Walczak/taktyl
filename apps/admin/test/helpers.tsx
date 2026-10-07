// Pomocnicze funkcje testow backpanelu: atrapa fetch (odpowiedzi JSON i problem+json), render z dostawcami.
import { render } from "@testing-library/react";
import { ToastProvider } from "@taktyl/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { setCsrfToken } from "../src/lib/api/client";
import { AuthProvider } from "../src/lib/auth/session";
import { makeQueryClient } from "../src/lib/query";

export const CSRF = "csrf-token-1234567890abcdef";

export function session(role: "owner" | "editor" | "viewer" = "owner") {
  return {
    user: { id: "u1", email: `${role}@taktyl.example`, role },
    csrf_token: CSRF,
    ...(role === "viewer" ? { demo: true } : {}),
  };
}

export function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ type: "about:blank", title: code, status, code, ...extra }),
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        ...(extra["headers"] as Record<string, string> | undefined),
      },
    },
  );
}

export function json(body: unknown, init: { status?: number; etag?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.etag !== undefined ? { ETag: `"${init.etag}"` } : {}),
    },
  });
}

export interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (call: Call) => Response | Promise<Response>;

/**
 * Atrapa fetch: klucz "METODA /sciezka" (bez query). Brak handlera = blad testu (404 z komunikatem).
 * Zwraca liste wywolan do asercji naglowkow (X-CSRF-Token, If-Match) i ciala.
 */
export function mockApi(routes: Record<string, Handler | Response>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const call: Call = {
        method,
        url,
        headers: Object.fromEntries(
          Object.entries((init?.headers ?? {}) as Record<string, string>),
        ),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      const path = url.split("?")[0] as string;
      const h = routes[`${method} ${path}`];
      if (!h) return problem(404, "not_found", { detail: `brak atrapy dla ${method} ${path}` });
      return typeof h === "function" ? h(call) : h.clone();
    }),
  );
  return calls;
}

export function renderWithProviders(ui: ReactElement, opts: { auth?: boolean } = {}) {
  setCsrfToken(null);
  const client = makeQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 0 } });
  const tree = (
    <QueryClientProvider client={client}>
      <ToastProvider>{opts.auth === false ? ui : <AuthProvider>{ui}</AuthProvider>}</ToastProvider>
    </QueryClientProvider>
  );
  return { client, ...render(tree) };
}

interface NavState {
  pathname: string;
  search: string;
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
}
/** Stan atrapy next/navigation (patrz setup.ts): sciezka, query i szpiedzy push/replace. */
export function nav(patch: Partial<Pick<NavState, "pathname" | "search">> = {}): NavState {
  const g = globalThis as { __nav?: NavState };
  g.__nav ??= { pathname: "/", search: "", push: vi.fn(), replace: vi.fn() };
  Object.assign(g.__nav, patch);
  return g.__nav;
}
