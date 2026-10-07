// TAKTYL-54 (S25-S36, docs/12 par. 7): pomocniki scenariuszy backpanelu i propagacji.
// Haslo owner pochodzi ze zmiennej srodowiskowej kontenera (ADMIN_BOOTSTRAP_* z .env stosu), nigdy z repozytorium.
// Konta editor i viewer tworzy setup przez API owner; ich hasla sa pochodna hasla owner (deterministyczne, zeby
// kolejny przebieg bez resetu kont mogl sie zalogowac; nigdzie nie zapisywane w repo ani w raportach).
import { createHash, createHmac } from "node:crypto";
import {
  request as playwrightRequest,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ADMIN_URL, SITE_URL } from "../playwright.config";

// Zadania z Node (APIRequestContext) nie korzystaja z --host-resolver-rules przegladarki, wiec ida na proxy z naglowkiem
// Host jak w przegladarce. Ciasteczko sesji jest przenoszone recznie (storageState zawiera domene panelu).
const PROXY = process.env.E2E_PROXY ?? "proxy:8080";
const hostOf = (url: string): string => new URL(url).host;

export function nodeContext(
  url: string,
  headers: Record<string, string> = {},
): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: `http://${PROXY}`,
    extraHTTPHeaders: { host: hostOf(url), accept: "application/json", ...headers },
  });
}

/** Wartosc ciasteczka sesji z pliku storageState. */
function sessionCookie(role: Role): string {
  const state = JSON.parse(readFileSync(authFile(role), "utf8")) as {
    cookies: { name: string; value: string }[];
  };
  const c = state.cookies.find((x) => x.name === "taktyl_session");
  if (!c) throw new Error(`Brak ciasteczka sesji ${role} w ${authFile(role)}`);
  return c.value;
}

/** Loguje przez API (bez interfejsu) i zapisuje stan jak Playwright; zwraca nic, test czyta plik. */
export async function loginViaApi(role: Role): Promise<void> {
  const { email, password } = credentials(role);
  const ctx = await nodeContext(ADMIN_URL);
  const res = await ctx.post("/v1/admin/auth/login", { data: { email, password } });
  expect(res.status(), `logowanie ${role}`).toBe(200);
  const raw = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
  const match = raw.map((h) => /taktyl_session=([^;]+)/.exec(h.value)).find(Boolean);
  if (!match) throw new Error("API nie zwrocilo ciasteczka sesji");
  mkdirSync(dirname(authFile(role)), { recursive: true });
  writeFileSync(
    authFile(role),
    JSON.stringify({
      cookies: [
        {
          name: "taktyl_session",
          value: match[1],
          domain: new URL(ADMIN_URL).hostname,
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
        },
      ],
      origins: [],
    }),
  );
  await ctx.dispose();
}

export type Role = "owner" | "editor" | "viewer";
export { ADMIN_URL };

export const authFile = (role: Role): string => `.auth/${role}.json`;

function env(name: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(`Brak zmiennej ${name} w kontenerze e2e (docker-compose.yml, .env stosu).`);
  return v;
}

export function credentials(role: Role): { email: string; password: string } {
  const ownerPassword = env("E2E_ADMIN_PASSWORD");
  if (role === "owner") return { email: env("E2E_ADMIN_EMAIL"), password: ownerPassword };
  const digest = createHash("sha256").update(`${role}:${ownerPassword}`).digest("base64url");
  return { email: `${role}-e2e@taktyl.example`, password: `E2e-${digest.slice(0, 24)}` };
}

/** Podpis webhooka jak w apps/api (docs/16 par. 3.6): hex(HMAC-SHA256(secret, `${timestamp}.${body}`)). */
export function signRevalidate(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function revalidateSecret(): string {
  return env("E2E_REVALIDATE_SECRET");
}

/**
 * Klient API backpanelu dla roli: ciasteczko sesji z storageState, naglowek CSRF z GET /auth/me, jak robi to interfejs.
 * Zadania ida przez ten sam host co panel (proxy /v1/*), wiec bez CORS.
 */
export class AdminApi {
  private constructor(
    readonly ctx: APIRequestContext,
    private csrf: string,
  ) {}

  static async as(role: Role): Promise<AdminApi> {
    const ctx = await nodeContext(ADMIN_URL, {
      cookie: `taktyl_session=${sessionCookie(role)}`,
    });
    const me = await ctx.get("/v1/admin/auth/me");
    expect(me.status(), `sesja ${role} wygasla albo setup nie dzialal`).toBe(200);
    const body = (await me.json()) as { csrf_token: string };
    return new AdminApi(ctx, body.csrf_token);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { "x-csrf-token": this.csrf, ...extra };
  }

  get(path: string): Promise<APIResponse> {
    return this.ctx.get(path);
  }

  post(path: string, data?: unknown, extra?: Record<string, string>): Promise<APIResponse> {
    return this.ctx.post(path, { data, headers: this.headers(extra) });
  }

  put(path: string, data: unknown, extra?: Record<string, string>): Promise<APIResponse> {
    return this.ctx.put(path, { data, headers: this.headers(extra) });
  }

  patch(path: string, data: unknown, extra?: Record<string, string>): Promise<APIResponse> {
    return this.ctx.patch(path, { data, headers: this.headers(extra) });
  }

  delete(path: string): Promise<APIResponse> {
    return this.ctx.delete(path, { headers: this.headers() });
  }

  async json<T>(res: APIResponse): Promise<T> {
    return (await res.json()) as T;
  }

  dispose(): Promise<void> {
    return this.ctx.dispose();
  }
}

export interface VariantDto {
  sku: string;
  price_gr: number;
  stock: number;
  version: number;
}

/** Wariant z odpowiedzi szczegolow produktu (admin). */
export async function getVariant(
  api: AdminApi,
  productId: string,
  sku: string,
): Promise<VariantDto> {
  const res = await api.get(`/v1/admin/products/${productId}`);
  expect(res.status()).toBe(200);
  const body = await api.json<{ variants: VariantDto[] }>(res);
  const v = body.variants.find((x) => x.sku === sku);
  if (!v) throw new Error(`Brak wariantu ${sku}`);
  return v;
}

/** Odczyt strony sklepu bez przegladarki (HTML po rewalidacji); cache nie jest omijany, bo to wlasnie mierzymy. */
export async function shopHtml(request: APIRequestContext, path: string): Promise<string> {
  const res = await request.get(path);
  expect(res.status()).toBe(200);
  return res.text();
}

/**
 * Czeka, az HTML strony sklepu zawiera tekst, i zwraca czas (ms) od wywolania. Test porownuje go z budzetem ADR-0003
 * (<= 5 s). Odpytuje co 200 ms zwyklym GET (przegladarka dopiero potem potwierdza widok).
 */
export async function waitForShop(
  request: APIRequestContext,
  path: string,
  predicate: (html: string) => boolean,
  budgetMs = 15_000,
): Promise<number> {
  const started = Date.now();
  for (;;) {
    const res = await request.get(path, { headers: { "cache-control": "no-cache" } });
    if (res.ok() && predicate(await res.text())) return Date.now() - started;
    if (Date.now() - started > budgetMs) {
      throw new Error(`Sklep nie pokazal zmiany na ${path} w ${budgetMs} ms`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Wchodzi na ekran panelu i czeka na koniec wczytywania (naglowek h1 strony). */
export async function openPanel(page: Page, path: string): Promise<void> {
  await page.goto(`${ADMIN_URL}${path}`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

/** Klient Node do sklepu (Host: taktyl.localhost przez proxy), np. do webhooka i odczytu HTML po rewalidacji. */
export function shopContext(): Promise<APIRequestContext> {
  return nodeContext(SITE_URL);
}

export const API_URL = process.env.E2E_API_URL ?? "http://api.taktyl.localhost";

/** Klient Node do publicznego API (Host: api.taktyl.localhost przez proxy). */
export function apiContext(): Promise<APIRequestContext> {
  return nodeContext(API_URL);
}

/** Stan wariantu przez API panelu (powod korekty jest wymagany). */
export async function setStock(
  api: AdminApi,
  sku: string,
  stock: number,
  reason: string,
): Promise<void> {
  const res = await api.put(`/v1/admin/variants/${sku}/stock`, { stock, reason });
  expect(res.status(), `PUT stock ${sku}`).toBe(200);
}

export interface SettingsSnapshot {
  version: string;
  settings: Record<string, unknown> & { free_shipping_threshold_gr: number };
}

/** Ustawienia sklepu z ETag (wersja do If-Match). */
export async function getSettings(api: AdminApi): Promise<SettingsSnapshot> {
  const res = await api.get("/v1/admin/settings");
  expect(res.status()).toBe(200);
  // Proxy dopisuje "-gzip" do ETag skompresowanej odpowiedzi (`"1-gzip"`), wersja to liczba na poczatku.
  const version = /(\d+)/.exec(res.headers()["etag"] ?? "")?.[1] ?? "";
  return { version, settings: await api.json(res) };
}

export async function patchSettings(
  api: AdminApi,
  version: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await api.patch("/v1/admin/settings", patch, { "if-match": `"${version}"` });
  expect(res.status(), `PATCH settings: ${await res.text()}`).toBe(200);
}

/**
 * POST /v1/orders ma limit 10/min/IP (docs/16); testy backpanelu skladaja zamowienia rownolegle z innymi, wiec przy 429
 * czekamy tyle, ile podaje Retry-After (z gora 70 s), i ponawiamy. Ten sam Idempotency-Key czyni ponowienie bezpiecznym.
 */
async function retryOn429(send: () => Promise<APIResponse>): Promise<APIResponse> {
  let res = await send();
  for (let i = 0; i < 3 && res.status() === 429; i++) {
    const wait = Math.min(Number(res.headers()["retry-after"] ?? 15) || 15, 70);
    await new Promise((r) => setTimeout(r, wait * 1000 + 250));
    res = await send();
  }
  return res;
}

export interface CreatedOrder {
  number: string;
  total_gr: number;
  token: string;
}

/**
 * Zamowienie jednym SKU przez publiczne API (jak sklep: klient niesie tylko SKU i ilosc; kwote liczy serwer).
 * Limit: POST /v1/orders 10/min/IP, wiec uzywaj oszczednie.
 */
export async function createOrder(
  sku: string,
  idempotencyKey: string,
  expectedTotalGr?: number,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const api = await apiContext();
  try {
    let expected = expectedTotalGr;
    if (expected === undefined) {
      const quote = await api.post("/v1/cart/quote", {
        data: { items: [{ type: "item", sku, qty: 1 }], shipping_method: "odbior" },
      });
      expect(quote.status()).toBe(200);
      expected = ((await quote.json()) as { summary: { total_gr: number } }).summary.total_gr;
    }
    const res = await retryOn429(() =>
      api.post("/v1/orders", {
        headers: { "idempotency-key": idempotencyKey },
        data: {
          items: [{ type: "item", sku, qty: 1 }],
          contact: { email: "jan@taktyl.example", phone: "500000000" },
          shipping: { method: "odbior", name: "Jan Testowy" },
          payment_type: "blik",
          consents: { terms: true, newsletter: false },
          expected_total_gr: expected,
        },
      }),
    );
    return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
  } finally {
    await api.dispose();
  }
}

/** Symulacja udanej platnosci (publiczne API, token zamowienia z odpowiedzi POST /orders). */
export async function payOrder(number: string, token: string): Promise<void> {
  const api = await apiContext();
  const res = await retryOn429(() =>
    api.post(`/v1/orders/${number}/payment/simulate`, {
      headers: { "x-order-token": token },
      data: { outcome: "paid" },
    }),
  );
  expect(res.status(), `platnosc ${number}`).toBe(200);
  await api.dispose();
}
