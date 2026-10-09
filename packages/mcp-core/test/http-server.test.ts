// I-014: transport Streamable HTTP klasy "open": bez uwierzytelniania, CORS tylko GET/POST/OPTIONS, limity, bezstanowy.
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createRateLimiter, defineTool, registerTools, startHttpServer } from "../src";

const ping = defineTool({
  name: "ping",
  title: "Ping",
  description: "Zwraca pong.",
  risk: "read",
  inputSchema: { n: z.number().optional() },
  run: async () => ({ pong: true }),
});

let closers: (() => void)[] = [];
afterEach(() => {
  for (const c of closers) c();
  closers = [];
});

async function start(options: Partial<Parameters<typeof startHttpServer>[0]> = {}) {
  const server = startHttpServer({
    port: 0,
    host: "127.0.0.1",
    createMcpServer: () => {
      const s = new McpServer({ name: "t", version: "0" });
      registerTools(s, [ping]);
      return s;
    },
    ...options,
  });
  await new Promise((r) => server.once("listening", r));
  closers.push(() => server.close());
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const rpc = (method: string, params: unknown = {}, id: number | undefined = 1) =>
  JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, params });
const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

describe("createRateLimiter", () => {
  it("liczy w oknie i odnawia je po uplywie czasu", () => {
    let t = 0;
    const limit = createRateLimiter(1000, 2, () => t);
    expect(limit("a").ok).toBe(true);
    expect(limit("a").ok).toBe(true);
    expect(limit("a")).toMatchObject({ ok: false, retryAfterSeconds: 1 });
    expect(limit("b").ok).toBe(true);
    t = 1500;
    expect(limit("a").ok).toBe(true);
  });
});

describe("startHttpServer", () => {
  it("odpowiada na /health bez uwierzytelniania", async () => {
    const base = await start();
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
  });

  it("CORS: tylko GET, POST i OPTIONS, dowolny origin, bez ciasteczek", async () => {
    const base = await start();
    const res = await fetch(`${base}/mcp`, {
      method: "OPTIONS",
      headers: { origin: "https://example.org" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("GET i DELETE na /mcp zwracaja 405 (tryb bezstanowy), nieznana sciezka 404", async () => {
    const base = await start();
    expect((await fetch(`${base}/mcp`)).status).toBe(405);
    expect((await fetch(`${base}/mcp`, { method: "DELETE" })).status).toBe(405);
    expect((await fetch(`${base}/inne`)).status).toBe(404);
  });

  it("obsluguje initialize i tools/list oraz tools/call bez zadnego klucza", async () => {
    const base = await start();
    const init = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      }),
    });
    expect(init.status).toBe(200);
    expect(init.headers.get("mcp-session-id")).toBeNull();
    const list = (await (
      await fetch(`${base}/mcp`, {
        method: "POST",
        headers: MCP_HEADERS,
        body: rpc("tools/list", {}, 2),
      })
    ).json()) as { result: { tools: { name: string }[] } };
    expect(list.result.tools.map((t) => t.name)).toEqual(["ping"]);
    const call = (await (
      await fetch(`${base}/mcp`, {
        method: "POST",
        headers: MCP_HEADERS,
        body: rpc("tools/call", { name: "ping", arguments: {} }, 3),
      })
    ).json()) as { result: { content: { text: string }[] } };
    expect(call.result.content[0]?.text).toContain("pong");
  });

  it("limit zapytan na IP zwraca 429 z Retry-After", async () => {
    const base = await start({ rateLimit: { windowMs: 60_000, max: 2 } });
    const post = () =>
      fetch(`${base}/mcp`, { method: "POST", headers: MCP_HEADERS, body: rpc("ping") });
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    const limited = await post();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("odrzuca zbyt duze cialo (413) i niepoprawny JSON (400)", async () => {
    const base = await start({ maxBodyBytes: 200 });
    const big = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: "x".repeat(500),
    });
    expect(big.status).toBe(413);
    const bad = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: "{nie json",
    });
    expect(bad.status).toBe(400);
  });
});
