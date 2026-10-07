// Adres API z perspektywy serwera Next (siec Compose). Przegladarka nie woluje API wprost: docs/14 §2 dopuszcza
// to tylko dla wycen i zamowien (inne zadania), przez proxy.
const FALLBACK = "http://localhost:4000";

/** INTERNAL_API_URL (docker-compose.yml), z zapasem na nazwe z docs/14 (API_URL_INTERNAL). Bez koncowego ukosnika. */
export function apiBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.INTERNAL_API_URL ?? env.API_URL_INTERNAL ?? FALLBACK;
  return raw.replace(/\/+$/, "");
}
