// I-014 (docs/24): wejscie serwera MCP front office. Transport stdio (domyslnie) albo Streamable HTTP (klasa "open").
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log, startHttpServer } from "@taktyl/mcp-core";
import { loadConfig } from "./config";
import { createFrontServer } from "./server";

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.TAKTYL_MCP_TRANSPORT === "http") {
    startHttpServer({
      port: config.TAKTYL_MCP_HTTP_PORT,
      host: config.TAKTYL_MCP_HTTP_HOST,
      createMcpServer: () => createFrontServer(config),
      maxBodyBytes: config.TAKTYL_MCP_MAX_BODY_BYTES,
      rateLimit: { windowMs: 60_000, max: config.TAKTYL_MCP_RATE_LIMIT },
      trustProxy: config.TAKTYL_MCP_TRUST_PROXY,
    });
    log("start", {
      server: "taktyl-front",
      transport: "http",
      port: config.TAKTYL_MCP_HTTP_PORT,
      orders: config.TAKTYL_MCP_ALLOW_ORDERS,
    });
    return;
  }
  await createFrontServer(config).connect(new StdioServerTransport());
  log("start", {
    server: "taktyl-front",
    transport: "stdio",
    orders: config.TAKTYL_MCP_ALLOW_ORDERS,
  });
}

main().catch(() => {
  log("fatal");
  process.exit(1);
});
