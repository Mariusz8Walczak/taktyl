// I-014: klient REST API serwerow MCP - adresy, ciasteczka, bledy problem+json, kontrakt, ponowienie po 401/csrf.
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, ContractError, buildUrl, createApiClient } from "../src";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

describe("buildUrl", () => {
  it("sklada adres bazowy, sciezke i zapytanie bez pustych wartosci", () => {
    expect(
      buildUrl("http://api:4000/", "/v1/products", {
        category: "myszki",
        cursor: undefined,
        q: "",
        limit: 6,
      }),
    ).toBe("http://api:4000/v1/products?category=myszki&limit=6");
  });
});

describe("createApiClient", () => {
  it("mapuje application/problem+json na ApiError z polami bledow i Retry-After", async () => {
    const fetchMock = vi.fn(async () =>
      json(
        {
          code: "validation_failed",
          detail: "Niepoprawne dane",
          errors: [{ path: "price_gr", message: "za malo" }],
        },
        { status: 422, headers: { "retry-after": "3" } },
      ),
    );
    const api = createApiClient({
      baseUrl: "http://api",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const err = await api.get("/v1/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: "validation_failed", retryAfter: "3" });
    expect((err as ApiError).errors[0]?.path).toBe("price_gr");
  });

  it("waliduje odpowiedz schematem i zglasza ContractError", async () => {
    const api = createApiClient({
      baseUrl: "http://api",
      fetch: (async () => json({ a: 1 })) as unknown as typeof fetch,
    });
    await expect(api.get("/v1/x", { schema: z.object({ a: z.string() }) })).rejects.toBeInstanceOf(
      ContractError,
    );
  });

  it("mapuje blad sieci i limit czasu na 504 bez przecieku szczegolow", async () => {
    const api = createApiClient({
      baseUrl: "http://api",
      fetch: (async () => {
        throw new TypeError("ECONNREFUSED 10.0.0.1:4000");
      }) as unknown as typeof fetch,
    });
    const err = (await api.get("/v1/x").catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(504);
    expect(err.message).not.toContain("10.0.0.1");
  });

  it("odrzuca zbyt duza odpowiedz", async () => {
    const api = createApiClient({
      baseUrl: "http://api",
      maxResponseBytes: 10,
      fetch: (async () => new Response("x".repeat(100))) as unknown as typeof fetch,
    });
    await expect(api.get("/v1/x")).rejects.toMatchObject({ code: "response_too_large" });
  });

  it("trzyma ciasteczka w pamieci i odsyla je, a Set-Cookie z pusta wartoscia je usuwa", async () => {
    const seen: (string | null)[] = [];
    let call = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("cookie"));
      call += 1;
      const res = json({});
      if (call === 1)
        res.headers.append(
          "set-cookie",
          "taktyl_session=abc123; HttpOnly; Secure; SameSite=Strict",
        );
      if (call === 3) res.headers.append("set-cookie", "taktyl_session=; Max-Age=0");
      return res;
    });
    const api = createApiClient({
      baseUrl: "http://api",
      useCookies: true,
      fetch: fetchMock as unknown as typeof fetch,
    });
    await api.get("/a");
    await api.get("/b");
    await api.get("/c");
    await api.get("/d");
    expect(seen).toEqual([null, "taktyl_session=abc123", "taktyl_session=abc123", null]);
    expect(api.cookieValues()).toEqual([]);
  });

  it("dokleja naglowki zalezne od zadania i ponawia raz po 401, gdy onAuthFailure zwroci true", async () => {
    let token = "stary";
    let calls = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      calls += 1;
      const csrf = new Headers(init?.headers).get("x-csrf-token");
      return csrf === "nowy" ? json({ ok: true }) : json({ code: "csrf_invalid" }, { status: 403 });
    });
    const api = createApiClient({
      baseUrl: "http://api",
      fetch: fetchMock as unknown as typeof fetch,
      extraHeaders: (method): Record<string, string> =>
        method === "GET" ? {} : { "x-csrf-token": token },
      onAuthFailure: async (e) => {
        token = "nowy";
        return e.code === "csrf_invalid";
      },
    });
    const res = await api.request("POST", "/v1/admin/x", { body: { a: 1 } });
    expect(res.data).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it("nie ponawia w nieskonczonosc: druga porazka wraca jako blad", async () => {
    const fetchMock = vi.fn(async () => json({ code: "unauthorized" }, { status: 401 }));
    const api = createApiClient({
      baseUrl: "http://api",
      fetch: fetchMock as unknown as typeof fetch,
      onAuthFailure: async () => true,
    });
    await expect(api.get("/v1/admin/x")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
