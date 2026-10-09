// I-014: konfiguracja serwera MCP front office (klasa "open") z zmiennych srodowiska. Zadnych poswiadczen: serwer nie zna
// hasel ani kluczy i nie ma dostepu do API backpanelu (tools.ts wola wylacznie sciezki publiczne /v1).
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  TAKTYL_API_URL: z.url().default("http://api:4000"),
  TAKTYL_MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  TAKTYL_MCP_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  TAKTYL_MCP_HTTP_HOST: z.string().default("0.0.0.0"),
  /** Zadan na minute z jednego IP. */
  TAKTYL_MCP_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(120),
  TAKTYL_MCP_MAX_BODY_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(4 * 1024 * 1024)
    .default(256 * 1024),
  TAKTYL_MCP_TRUST_PROXY: bool,
  /** Narzedzia zapisujace (zalozenie zamowienia, symulacja platnosci). Domyslnie wylaczone: otwarty endpoint nie zaklada zamowien. */
  TAKTYL_MCP_ALLOW_ORDERS: bool,
});

export type FrontConfig = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): FrontConfig {
  return schema.parse(env);
}
