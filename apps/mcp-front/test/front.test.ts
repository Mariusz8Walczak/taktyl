// I-014: serwer MCP front office (klasa open): tylko publiczne API /v1, tylko odczyt, zapis za flaga ALLOW_ORDERS.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createApiClient } from "@taktyl/mcp-core";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config";
import { createFrontServer } from "../src/server";
import { buildTools, orderTools, readTools } from "../src/tools";

const IDEM = randomUUID();
const WRITE_TOOLS = ["create_order", "simulate_payment"];
const ORDER_TOOLS = ["create_order", "get_order", "list_orders", "simulate_payment"];

function fakeApi(handler: (url: string, init?: RequestInit) => unknown) {
  const calls: { url: string; method: string; headers: Headers; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      ...(typeof init?.body === "string" ? { body: JSON.parse(init.body) } : {}),
    });
    return new Response(JSON.stringify(handler(url, init)), {
      headers: { "content-type": "application/json" },
    });
  });
  return {
    api: createApiClient({
      baseUrl: "http://api:4000",
      fetch: fetchMock as unknown as typeof fetch,
    }),
    calls,
  };
}

async function client(allowOrders: boolean, api = fakeApi(() => ({})).api) {
  const server = createFrontServer(
    loadConfig({ TAKTYL_MCP_ALLOW_ORDERS: String(allowOrders) }),
    api,
  );
  const c = new Client({ name: "t", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), c.connect(b)]);
  return c;
}

describe("konfiguracja", () => {
  it("domyslnie: stdio, zamowienia wylaczone, adres API wewnatrz compose", () => {
    const c = loadConfig({});
    expect(c).toMatchObject({
      TAKTYL_MCP_TRANSPORT: "stdio",
      TAKTYL_MCP_ALLOW_ORDERS: false,
      TAKTYL_API_URL: "http://api:4000",
    });
  });
  it("flaga zamowien wlacza sie tylko jawnie", () => {
    expect(loadConfig({ TAKTYL_MCP_ALLOW_ORDERS: "true" }).TAKTYL_MCP_ALLOW_ORDERS).toBe(true);
    expect(loadConfig({ TAKTYL_MCP_ALLOW_ORDERS: "" }).TAKTYL_MCP_ALLOW_ORDERS).toBe(false);
  });
});

describe("klasa open: gwarancje", () => {
  it("narzedzia domyslne to wylacznie odczyt, bez zadnego narzedzia zapisujacego", async () => {
    const c = await client(false);
    const { tools } = await c.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(19);
    for (const t of tools) expect(t.annotations?.readOnlyHint, t.name).toBe(true);
    for (const name of ORDER_TOOLS) expect(tools.map((t) => t.name)).not.toContain(name);
    expect(tools.map((t) => t.name)).toContain("quote_cart");
  });

  it("z TAKTYL_MCP_ALLOW_ORDERS=true dochodza narzedzia zamowien, a zapisujace nie maja readOnlyHint", async () => {
    const c = await client(true);
    const { tools } = await c.listTools();
    for (const name of ORDER_TOOLS) expect(tools.map((t) => t.name)).toContain(name);
    for (const t of tools.filter((x) => WRITE_TOOLS.includes(x.name)))
      expect(t.annotations?.readOnlyHint).toBe(false);
  });

  it("kod nie zawiera sciezek /v1/admin ani poswiadczen admina", () => {
    const sources = [
      "../src/tools.ts",
      "../src/server.ts",
      "../src/main.ts",
      "../src/config.ts",
    ].map((p) => readFileSync(new URL(p, import.meta.url), "utf8"));
    for (const s of sources) {
      expect(s).not.toMatch(/\/v1\/admin/);
      expect(s).not.toMatch(/ADMIN_(EMAIL|PASSWORD)|csrf|taktyl_session/i);
    }
  });

  it("wszystkie wywolania ida na publiczne /v1 (sprawdzone na calej liscie narzedzi)", async () => {
    const f = fakeApi(() => ({}));
    for (const tool of buildTools(f.api, true)) {
      // odpowiedz {} nie przejdzie walidacji kontraktu: interesuje nas tylko sciezka zadania
      const input: Record<string, unknown> = {
        category: "myszki",
        slug: "bazalt-75",
        q: "lupek",
        method: "kurier",
        number: "TK-261008-AB12",
        order_token: "t".repeat(24),
        order_tokens: ["t".repeat(24)],
        outcome: "paid",
        idempotency_key: IDEM,
        order: {},
        items: [{ type: "item", sku: "M-PST-GRF", qty: 1 }],
      };
      await tool.run(input, {}).catch(() => undefined);
    }
    expect(f.calls.length).toBeGreaterThan(15);
    for (const c of f.calls) expect(new URL(c.url).pathname, c.url).toMatch(/^\/v1\//);
    for (const c of f.calls) expect(new URL(c.url).pathname, c.url).not.toMatch(/\/admin/);
  });
});

describe("narzedzia", () => {
  it("quote_cart wola POST /v1/cart/quote z cialem bez cen, a odpowiedz przechodzi kontrakt", async () => {
    const f = fakeApi(() => ({
      currency: "PLN",
      lines: [
        {
          type: "item",
          sku: "M-PST-GRF",
          name: "Pustulka",
          qty: 1,
          price_gr: 39900,
          coupon_discount_gr: 0,
          stock: 9,
          available: true,
        },
      ],
      summary: {
        products_gr: 39900,
        set_discount_gr: 0,
        coupon_discount_gr: 0,
        shipping_from_gr: 1500,
        total_gr: 39900,
        free_shipping_remaining_gr: 0,
      },
      coupon: null,
      problems: [],
    }));
    const c = await client(false, f.api);
    const res = await c.callTool({
      name: "quote_cart",
      arguments: { items: [{ type: "item", sku: "M-PST-GRF", qty: 1 }] },
    });
    expect(res.isError).toBeFalsy();
    expect(f.calls[0]).toMatchObject({ method: "POST" });
    expect(new URL(f.calls[0]!.url).pathname).toBe("/v1/cart/quote");
    expect(f.calls[0]!.body).toEqual({ items: [{ type: "item", sku: "M-PST-GRF", qty: 1 }] });
  });

  it("odpowiedz niezgodna z kontraktem to blad narzedzia, nie surowe dane", async () => {
    const c = await client(false, fakeApi(() => ({ nieznane: true })).api);
    const res = await c.callTool({ name: "list_categories", arguments: {} });
    expect(res.isError).toBe(true);
  });

  it("slug ze znakami sciezki jest odrzucany zanim powstanie zadanie", async () => {
    const f = fakeApi(() => ({}));
    const c = await client(false, f.api);
    const res = await c.callTool({ name: "get_product", arguments: { slug: "../admin/users" } });
    expect(res.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });

  it("create_order wysyla Idempotency-Key, a dane osobowe tylko z wywolania", async () => {
    const f = fakeApi(() => ({ number: "TK-261008-AB12" }));
    const tool = orderTools(f.api).find((t) => t.name === "create_order")!;
    await tool
      .run(
        {
          idempotency_key: IDEM,
          order: { contact: { email: "ola@taktyl.example" } },
        },
        {},
      )
      .catch(() => undefined);
    expect(f.calls[0]!.headers.get("idempotency-key")).toBe(IDEM);
    expect(f.calls[0]!.body).toEqual({ contact: { email: "ola@taktyl.example" } });
  });

  it("lista narzedzi odczytu nie zawiera zapisujacych", () => {
    const names = readTools(fakeApi(() => ({})).api).map((t) => t.name);
    for (const w of ORDER_TOOLS) expect(names).not.toContain(w);
  });
});
