// I-014 (docs/24): wejscie serwera MCP backoffice. Wylacznie stdio: bez HTTP, bo ma uwierzytelnienie i prawa zapisu.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log } from "@taktyl/mcp-core";
import { loadConfig } from "./config";
import { createAdminServer } from "./server";

async function main(): Promise<void> {
  const config = loadConfig();
  await createAdminServer(config).connect(new StdioServerTransport());
  log("start", {
    server: "taktyl-admin",
    transport: "stdio",
    mode:
      config.TAKTYL_ADMIN_EMAIL && config.TAKTYL_ADMIN_PASSWORD
        ? "login"
        : config.TAKTYL_ADMIN_DEMO
          ? "demo-viewer"
          : "brak-poswiadczen",
  });
}

main().catch(() => {
  log("fatal");
  process.exit(1);
});
