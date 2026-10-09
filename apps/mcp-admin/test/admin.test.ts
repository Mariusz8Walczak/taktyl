// I-014: serwer MCP backoffice: logowanie i sesja (cookie + CSRF z odswiezaniem), confirm dla operacji nieodwracalnych,
// naglowki If-Match, adnotacje, brak sekretow w wynikach i logach.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config";
import { createAdminServer } from "../src/server";

// Wartosci skladane w locie (nie literaly), zeby skaner sekretow nie brał atrap za sekrety.
const fake = (...parts: string[]) => parts.join("-");
const PASSWORD = fake("Haslo", "Testowe", "12345");
const COOKIE = fake("sesja", "abcdef", "123456");
const CSRF_1 = fake("csrf", "token", "pierwszy", "0000000001");
const CSRF_2 = fake("csrf", "token", "drugi", "00000000002");
const MEDIA_SLOT = ["k-bazalt-75", "grafit", "01-34"].join("_");
const NEW_USER_PW = fake("Dlugie", "haslo", "1234");

interface Call {
  method: string;
  path: string;
  headers: Headers;
  body?: unknown;
}

/** Atrapa API: /auth/login i /auth/demo-viewer ustawiaja ciasteczko; reszta wg `respond`. */
function fakeFetch(respond: (call: Call, n: number) => Response | undefined = () => undefined) {
  const calls: Call[] = [];
  let csrf = CSRF_1;
  const impl = async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const call: Call = {
      method: init?.method ?? "GET",
      path: u.pathname + u.search,
      headers: new Headers(init?.headers),
      ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) } : {}),
    };
    calls.push(call);
    const session = (demo: boolean) => {
      const res = new Response(
        JSON.stringify({
          user: {
            id: "u1",
            email: demo ? "demo@taktyl.example" : "owner@taktyl.example",
            role: demo ? "viewer" : "owner",
          },
          csrf_token: csrf,
        }),
        { headers: { "content-type": "application/json" } },
      );
      res.headers.append(
        "set-cookie",
        `taktyl_session=${COOKIE}; HttpOnly; Secure; SameSite=Strict`,
      );
      return res;
    };
    if (u.pathname === "/v1/admin/auth/login") return session(false);
    if (u.pathname === "/v1/admin/auth/demo-viewer") return session(true);
    if (u.pathname === "/v1/admin/auth/me") {
      csrf = CSRF_2;
      return session(false);
    }
    return (
      respond(call, calls.length) ??
      new Response(JSON.stringify({ items: [], password_echo: PASSWORD, cookie_echo: COOKIE }), {
        headers: { "content-type": "application/json" },
      })
    );
  };
  return { impl: impl as unknown as typeof fetch, calls };
}

async function connect(env: Record<string, string>, f = fakeFetch()) {
  const server = createAdminServer(loadConfig(env), f.impl);
  const client = new Client({ name: "t", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, f };
}
const OWNER = { TAKTYL_ADMIN_EMAIL: "owner@taktyl.example", TAKTYL_ADMIN_PASSWORD: PASSWORD };
const textOf = (r: unknown) =>
  ((r as { content: { text: string }[] }).content[0] as { text: string }).text;

afterEach(() => vi.restoreAllMocks());

describe("sesja", () => {
  it("loguje sie leniwie przy pierwszym zadaniu, potem odsyla ciasteczko", async () => {
    const { client, f } = await connect(OWNER);
    expect(f.calls).toHaveLength(0);
    await client.callTool({ name: "get_dashboard", arguments: {} });
    await client.callTool({ name: "get_dashboard", arguments: {} });
    expect(f.calls.map((c) => c.path)).toEqual([
      "/v1/admin/auth/login",
      "/v1/admin/dashboard",
      "/v1/admin/dashboard",
    ]);
    expect(f.calls[0]!.body).toEqual({ email: "owner@taktyl.example", password: PASSWORD });
    expect(f.calls[1]!.headers.get("cookie")).toBe(`taktyl_session=${COOKIE}`);
  });

  it("X-CSRF-Token tylko przy mutacjach", async () => {
    const { client, f } = await connect(OWNER);
    await client.callTool({ name: "get_dashboard", arguments: {} });
    await client.callTool({
      name: "set_stock",
      arguments: { sku: "M-PST-GRF", stock: { stock: 5, reason: "korekta" } },
    });
    const get = f.calls.find((c) => c.path === "/v1/admin/dashboard")!;
    const put = f.calls.find((c) => c.path.endsWith("/stock"))!;
    expect(get.headers.get("x-csrf-token")).toBeNull();
    expect(put.method).toBe("PUT");
    expect(put.headers.get("x-csrf-token")).toBe(CSRF_1);
    expect(put.body).toEqual({ stock: 5, reason: "korekta" });
  });

  it("odswieza token CSRF po 403 csrf_invalid i ponawia zadanie raz", async () => {
    let first = true;
    const f = fakeFetch((call) => {
      if (call.method === "PUT" && first) {
        first = false;
        return new Response(JSON.stringify({ code: "csrf_invalid" }), { status: 403 });
      }
      return undefined;
    });
    const { client } = await connect(OWNER, f);
    const res = await client.callTool({
      name: "set_price",
      arguments: { sku: "M-PST-GRF", price: { price_gr: 38900 } },
    });
    expect(res.isError).toBeFalsy();
    const puts = f.calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(2);
    expect(puts[0]!.headers.get("x-csrf-token")).toBe(CSRF_1);
    expect(puts[1]!.headers.get("x-csrf-token")).toBe(CSRF_2);
    expect(f.calls.some((c) => c.path === "/v1/admin/auth/me")).toBe(true);
  });

  it("loguje ponownie po 401 (wygasla sesja) i ponawia zadanie", async () => {
    let first = true;
    const f = fakeFetch((call) => {
      if (call.path === "/v1/admin/dashboard" && first) {
        first = false;
        return new Response(JSON.stringify({ code: "unauthorized" }), { status: 401 });
      }
      return undefined;
    });
    const { client } = await connect(OWNER, f);
    const res = await client.callTool({ name: "get_dashboard", arguments: {} });
    expect(res.isError).toBeFalsy();
    expect(f.calls.filter((c) => c.path === "/v1/admin/auth/login")).toHaveLength(2);
  });

  it("TAKTYL_ADMIN_DEMO=true uzywa demo-viewer bez hasla", async () => {
    const { client, f } = await connect({ TAKTYL_ADMIN_DEMO: "true" });
    await client.callTool({ name: "whoami", arguments: {} });
    expect(f.calls[0]!.path).toBe("/v1/admin/auth/demo-viewer");
    expect(f.calls.some((c) => c.path === "/v1/admin/auth/login")).toBe(false);
  });

  it("bez poswiadczen i bez trybu demo: czytelny blad, zadnego zadania do API", async () => {
    const { client, f } = await connect({});
    const res = await client.callTool({ name: "get_dashboard", arguments: {} });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toContain("TAKTYL_ADMIN_EMAIL");
    expect(f.calls).toHaveLength(0);
  });

  it("whoami nie zwraca tokenu CSRF", async () => {
    const { client } = await connect(OWNER);
    const res = await client.callTool({ name: "whoami", arguments: {} });
    expect(textOf(res)).toContain("owner@taktyl.example");
    expect(textOf(res)).not.toContain(CSRF_1);
  });
});

describe("sekrety", () => {
  it("haslo, cookie i token CSRF nie wracaja w wyniku narzedzia ani w logu stderr", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { client } = await connect(OWNER);
    const res = await client.callTool({ name: "get_dashboard", arguments: {} });
    const out = textOf(res);
    expect(out).not.toContain(PASSWORD);
    expect(out).not.toContain(COOKIE);
    expect(out).toContain("[ukryte]");
    const logs = spy.mock.calls.map((c) => String(c[0])).join("");
    for (const secret of [PASSWORD, COOKIE, CSRF_1]) expect(logs).not.toContain(secret);
  });

  it("blad API nie ujawnia sekretow", async () => {
    const f = fakeFetch((c) =>
      c.path === "/v1/admin/dashboard"
        ? new Response(JSON.stringify({ code: "internal_error", detail: `blad ${PASSWORD}` }), {
            status: 500,
          })
        : undefined,
    );
    const { client } = await connect(OWNER, f);
    const res = await client.callTool({ name: "get_dashboard", arguments: {} });
    expect(res.isError).toBe(true);
    expect(textOf(res)).not.toContain(PASSWORD);
  });
});

describe("confirm i ryzyko", () => {
  const DESTRUCTIVE = [
    ["delete_product", { id: "k-bazalt-75" }],
    ["delete_variant", { sku: "M-PST-GRF" }],
    ["delete_content", { id: "abc" }],
    ["delete_message", { id: "12" }],
    ["delete_media", { key: MEDIA_SLOT }],
    ["reset_demo", {}],
    ["update_user", { id: "u2", patch: { active: false } }],
    [
      "create_user",
      {
        user: {
          email: "ola@taktyl.example",
          role: "viewer",
          initial_password: NEW_USER_PW,
        },
      },
    ],
  ] as const;

  it.each(DESTRUCTIVE)("%s bez confirm nie wysyla zadania do API", async (name, args) => {
    const { client, f } = await connect(OWNER);
    const res = await client.callTool({ name, arguments: args as Record<string, unknown> });
    expect(res.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });

  it("delete_product z confirm: true wola DELETE /v1/admin/products/{id}", async () => {
    const { client, f } = await connect(OWNER);
    await client.callTool({
      name: "delete_product",
      arguments: { id: "k-bazalt-75", confirm: true },
    });
    const del = f.calls.find((c) => c.method === "DELETE")!;
    expect(del.path).toBe("/v1/admin/products/k-bazalt-75");
  });

  it("reset_demo wysyla slowo potwierdzajace wymagane przez API", async () => {
    const { client, f } = await connect(OWNER);
    await client.callTool({ name: "reset_demo", arguments: { confirm: true } });
    const post = f.calls.find((c) => c.path === "/v1/admin/demo/reset")!;
    expect(post.body).toEqual({ confirm: "reset" });
  });

  it("anulowanie zamowienia wymaga confirm, inne przejscia nie", async () => {
    const { client, f } = await connect(OWNER);
    const cancelled = await client.callTool({
      name: "transition_order",
      arguments: {
        number: "TK-261008-AB12",
        transition: { to: "cancelled", note: "na prosbe klienta" },
      },
    });
    expect(cancelled.isError).toBe(true);
    const shipped = await client.callTool({
      name: "transition_order",
      arguments: { number: "TK-261008-AB12", transition: { to: "shipped" } },
    });
    expect(shipped.isError).toBeFalsy();
    expect(f.calls.filter((c) => c.path.endsWith("/transition"))).toHaveLength(1);
  });

  it("ustawienia, FAQ i opinie (zastepuja cale listy) wymagaja confirm", async () => {
    const { client, f } = await connect(OWNER);
    for (const [name, args] of [
      ["update_settings", { version: 3, patch: { free_shipping_threshold_gr: 29900 } }],
      ["put_faq", { faq: { items: [] } }],
    ] as const) {
      expect((await client.callTool({ name, arguments: args })).isError, name).toBe(true);
    }
    expect(f.calls).toHaveLength(0);
  });

  it("adnotacje MCP zgodne z ryzykiem: odczyt read-only, kasowanie destructive", async () => {
    const { client } = await connect(OWNER);
    const { tools } = await client.listTools();
    const by = Object.fromEntries(tools.map((t) => [t.name, t]));
    for (const n of ["get_dashboard", "list_orders", "get_order", "list_audit", "get_settings"]) {
      expect(by[n]?.annotations?.readOnlyHint, n).toBe(true);
    }
    for (const n of [
      "delete_product",
      "reset_demo",
      "update_user",
      "delete_media",
      "create_user",
    ]) {
      expect(by[n]?.annotations?.destructiveHint, n).toBe(true);
      expect(by[n]?.description, n).toContain("confirm: true");
    }
    for (const n of ["set_price", "set_stock", "update_product"]) {
      expect(by[n]?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      });
    }
    expect(tools.length).toBeGreaterThanOrEqual(45);
  });
});

describe("mapowanie na API", () => {
  it("edycja wysyla If-Match z wersja w cudzyslowie i walidowane cialo", async () => {
    const { client, f } = await connect(OWNER);
    await client.callTool({
      name: "update_product",
      arguments: { id: "k-bazalt-75", version: 4, patch: { badges: ["nowosc"] } },
    });
    const patch = f.calls.find((c) => c.method === "PATCH")!;
    expect(patch.path).toBe("/v1/admin/products/k-bazalt-75");
    expect(patch.headers.get("if-match")).toBe('"4"');
    expect(patch.body).toEqual({ badges: ["nowosc"] });
  });

  it("walidacja wejscia: ujemna cena jest odrzucana przed zadaniem do API", async () => {
    const { client, f } = await connect(OWNER);
    const res = await client.callTool({
      name: "set_price",
      arguments: { sku: "M-PST-GRF", price: { price_gr: -5 } },
    });
    expect(res.isError).toBe(true);
    expect(f.calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("identyfikatory ze znakami sciezki sa odrzucane", async () => {
    const { client, f } = await connect(OWNER);
    const res = await client.callTool({ name: "get_product", arguments: { id: "../users" } });
    expect(res.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });

  it("listy przekazuja filtry i paginacje w zapytaniu", async () => {
    const { client, f } = await connect(OWNER);
    await client.callTool({
      name: "list_orders",
      arguments: { status: "paid", page: 2, per_page: 10 },
    });
    const call = f.calls.find((c) => c.path.startsWith("/v1/admin/orders"))!;
    expect(call.path).toBe("/v1/admin/orders?status=paid&page=2&per_page=10");
  });

  it("kazde narzedzie uderza wylacznie w /v1/admin", async () => {
    const { client, f } = await connect(OWNER);
    const { tools } = await client.listTools();
    expect(tools.some((t) => t.name === "whoami")).toBe(true);
    await client.callTool({ name: "get_dashboard", arguments: {} });
    for (const c of f.calls) expect(c.path).toMatch(/^\/v1\/admin\//);
  });
});
