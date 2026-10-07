// B-103 (docs/14 par. 11): walidacja zmiennych srodowiskowych schematem Zod. Brak lub zly format = start przerwany.
import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const boolTrue = z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true");

const secret = z.string().min(32, "min. 32 znaki (losowy ciag)");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//, "oczekiwano adresu postgresql://"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_CORS_ORIGINS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  SESSION_SECRET: secret,
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(8),
  ADMIN_BOOTSTRAP_EMAIL: z
    .string()
    .email()
    .refine((v) => v.endsWith("@taktyl.example"), "adres wylacznie w domenie taktyl.example")
    .optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).optional(),
  DEMO_MODE: bool,
  DEMO_RESET_CRON: z.string().default("0 4 * * *"),
  REVALIDATE_URL: z.string().url().optional(),
  REVALIDATE_SECRET: secret,
  SHOP_REVALIDATE_SECONDS: z.coerce.number().int().min(1).default(300),
  ORDER_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  MEDIA_DIR: z.string().default("/data/media"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  METRICS_ENABLED: bool,
  // B-230/B-231 (TAKTYL-22): limity zadan i dokumentacja OpenAPI (poza produkcja zawsze wlaczona).
  RATE_LIMIT_ENABLED: boolTrue,
  OPENAPI_ENABLED: bool,
});

export type AppConfig = z.infer<typeof envSchema>;

/** B-103: parsuje env; przy bledzie rzuca wyjatek z lista pol (bez wartosci, zeby nie ujawniac sekretow). */
export function loadEnv(source: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `- ${i.path.join(".") || "(env)"}: ${i.message}`);
    throw new Error(`Niepoprawna konfiguracja srodowiska:\n${lines.join("\n")}`);
  }
  return parsed.data;
}
