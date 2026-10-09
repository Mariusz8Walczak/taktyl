// I-014: fabryka serwera MCP front office. Nazwa i instrukcje widzi klient MCP przy polaczeniu.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createApiClient, registerTools, type ApiClient } from "@taktyl/mcp-core";
import type { FrontConfig } from "./config";
import { buildTools } from "./tools";

export const INSTRUCTIONS =
  "Taktyl to fikcyjny sklep demonstracyjny (klawiatury, myszki, podkladki, kreator setu z rabatem za komplet). " +
  "Serwer jest otwarty (klasa open): bez logowania i bez kluczy, narzedzia sa tylko do odczytu, a wycena koszyka niczego nie zapisuje. " +
  "Ceny sa w groszach (liczby calkowite). Nie podawaj prawdziwych danych osobowych ani platniczych: sklep tego nie przyjmuje.";

export function createFrontServer(config: FrontConfig, api?: ApiClient): McpServer {
  const client = api ?? createApiClient({ baseUrl: config.TAKTYL_API_URL });
  const server = new McpServer(
    { name: "taktyl-front", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );
  registerTools(server, buildTools(client, config.TAKTYL_MCP_ALLOW_ORDERS));
  return server;
}
