// I-014: transport Streamable HTTP dla serwera MCP klasy "open" (front office): bez uwierzytelniania i bez kluczy.
// Bez stanu (po jednym serwerze i transporcie na zadanie), odpowiedzi JSON (bez SSE), CORS tylko GET/POST/OPTIONS,
// limit zapytan na IP (okno stale), limit rozmiaru ciala, limity czasu. Adres publiczny wskaze wlasciciel; tu nie ma hostingu.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { log } from "./redact";

export interface HttpServerOptions {
  port: number;
  host?: string;
  /** Fabryka serwera MCP: nowa instancja na kazde zadanie (tryb bezstanowy). */
  createMcpServer: () => McpServer;
  path?: string;
  maxBodyBytes?: number;
  rateLimit?: { windowMs: number; max: number };
  /** Ufaj pierwszemu adresowi z X-Forwarded-For (tylko za zaufanym proxy). */
  trustProxy?: boolean;
  /** Maksymalna liczba rownoczesnych zadan MCP (ochrona przed zalewem). */
  maxConcurrent?: number;
}

export const DEFAULT_MAX_BODY_BYTES = 256 * 1024;
export const DEFAULT_RATE_LIMIT = { windowMs: 60_000, max: 120 };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id",
  "access-control-expose-headers": "mcp-session-id",
  "access-control-max-age": "600",
} as const;

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
): void {
  if (res.headersSent) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...CORS,
    ...extra,
  });
  res.end(payload);
}

const rpcError = (code: number, message: string) => ({
  jsonrpc: "2.0",
  error: { code, message },
  id: null,
});

class BodyTooLarge extends Error {}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers["content-length"] ?? "0");
  if (declared > maxBytes) throw new BodyTooLarge();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) throw new BodyTooLarge();
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createRateLimiter(windowMs: number, max: number, now: () => number = Date.now) {
  const hits = new Map<string, { start: number; count: number }>();
  return (key: string): { ok: boolean; retryAfterSeconds: number } => {
    const t = now();
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
    }
    const cur = hits.get(key);
    if (!cur || t - cur.start >= windowMs) {
      hits.set(key, { start: t, count: 1 });
      return { ok: true, retryAfterSeconds: 0 };
    }
    cur.count += 1;
    return cur.count > max
      ? { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((cur.start + windowMs - t) / 1000)) }
      : { ok: true, retryAfterSeconds: 0 };
  };
}

export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers["x-forwarded-for"];
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function startHttpServer(options: HttpServerOptions): Server {
  const path = options.path ?? "/mcp";
  const maxBody = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const limit = createRateLimiter(
    (options.rateLimit ?? DEFAULT_RATE_LIMIT).windowMs,
    (options.rateLimit ?? DEFAULT_RATE_LIMIT).max,
  );
  const maxConcurrent = options.maxConcurrent ?? 32;
  let active = 0;

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS);
        res.end();
        return;
      }
      if (url.pathname === "/health" && req.method === "GET") {
        send(res, 200, { status: "ok" });
        return;
      }
      if (url.pathname !== path) {
        send(res, 404, { error: "not_found" });
        return;
      }
      if (req.method !== "POST") {
        // Tryb bezstanowy: bez strumienia SSE i bez sesji, wiec GET i DELETE nie maja sensu.
        send(res, 405, rpcError(-32000, "Method not allowed. Uzyj POST."), {
          allow: "POST, OPTIONS",
        });
        return;
      }
      const rl = limit(clientIp(req, options.trustProxy ?? false));
      if (!rl.ok) {
        send(res, 429, rpcError(-32000, "Za duzo zapytan. Sprobuj pozniej."), {
          "retry-after": String(rl.retryAfterSeconds),
        });
        return;
      }
      if (active >= maxConcurrent) {
        send(res, 503, rpcError(-32000, "Serwer jest zajety. Sprobuj za chwile."), {
          "retry-after": "1",
        });
        return;
      }
      let body: unknown;
      try {
        body = await readBody(req, maxBody);
      } catch (error) {
        if (error instanceof BodyTooLarge)
          send(res, 413, rpcError(-32000, "Zadanie jest za duze."));
        else send(res, 400, rpcError(-32700, "Niepoprawny JSON."));
        return;
      }
      active += 1;
      const mcp = options.createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on("close", () => {
        active -= 1;
        void transport.close();
        void mcp.close();
      });
      try {
        await mcp.connect(transport);
        await transport.handleRequest(req, res, body);
      } catch {
        log("http_error");
        send(res, 500, rpcError(-32603, "Blad wewnetrzny serwera."));
      }
    })();
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.listen(options.port, options.host ?? "0.0.0.0");
  return server;
}
