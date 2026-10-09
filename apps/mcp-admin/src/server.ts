// I-014: fabryka serwera MCP backoffice (tylko stdio, z uwierzytelnieniem w API).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools, type ApiClientOptions } from "@taktyl/mcp-core";
import type { AdminConfig } from "./config";
import { createAdminApi } from "./session";
import { adminTools } from "./tools";

export const INSTRUCTIONS =
  "Backoffice sklepu demonstracyjnego Taktyl: pelny panel przez API (/v1/admin). Dzialasz z rola konta z konfiguracji (owner, editor albo viewer); " +
  "narzedzie whoami pokazuje role. Edycje wymagaja version z odczytu (If-Match). Operacje nieodwracalne (usuwanie, reset demo, uzytkownicy, ustawienia) " +
  "wymagaja confirm: true: uzywaj go tylko po wyraznej zgodzie wlasciciela. Ceny w groszach. Kazda zmiana trafia do dziennika zmian.";

export function createAdminServer(
  config: AdminConfig,
  fetchImpl?: ApiClientOptions["fetch"],
): McpServer {
  const { api, redact } = createAdminApi(config, fetchImpl);
  const server = new McpServer(
    { name: "taktyl-admin", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );
  registerTools(server, adminTools(api), { redact });
  return server;
}
