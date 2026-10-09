// I-014: konfiguracja serwera MCP backoffice (tylko stdio). Poswiadczenia wylacznie ze zmiennych srodowiska
// (nigdy z repozytorium, argumentow wywolania ani narzedzi). Brak poswiadczen = tryb demo (rola viewer, tylko odczyt)
// po TAKTYL_ADMIN_DEMO=true; bez obu serwer zglasza blad przy pierwszym uzyciu, a nie przy starcie.
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  TAKTYL_API_URL: z.url().default("http://api:4000"),
  TAKTYL_ADMIN_EMAIL: z.string().max(254).optional(),
  TAKTYL_ADMIN_PASSWORD: z.string().max(200).optional(),
  /** POST /v1/admin/auth/demo-viewer (wymaga DEMO_MODE=true w API): sesja viewer bez hasla. */
  TAKTYL_ADMIN_DEMO: bool,
});

export type AdminConfig = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): AdminConfig {
  return schema.parse(env);
}
