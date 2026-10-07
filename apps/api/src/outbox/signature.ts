// B-060, B-061 (ADR-0003, docs/14 par. 7 A08, docs/16 par. 3.6): podpis webhooka rewalidacji api -> web.
// X-Taktyl-Signature = hex(HMAC-SHA256(REVALIDATE_SECRET, `${timestamp}.${body}`)), X-Taktyl-Timestamp = sekundy unix.
// Odbiornik (apps/web/src/app/api/revalidate) ma wlasna kopie tej logiki; oba pliki testuja ten sam wektor.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "X-Taktyl-Signature";
export const TIMESTAMP_HEADER = "X-Taktyl-Timestamp";
/** Okno odpornosci na replay (docs/14 par. 7): 5 minut w obie strony. */
export const MAX_SKEW_SECONDS = 300;

export function signPayload(secret: string, timestamp: number | string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type SignatureCheck = "ok" | "missing" | "stale" | "bad";

/** Weryfikacja podpisu w stalym czasie; `stale` = poprawny podpis, ale znacznik czasu poza oknem. */
export function verifySignature(input: {
  secret: string;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  body: string;
  nowMs: number;
}): SignatureCheck {
  const { secret, timestamp, signature, body, nowMs } = input;
  if (!timestamp || !signature) return "missing";
  if (!/^\d{1,12}$/.test(timestamp)) return "bad";
  const expected = Buffer.from(signPayload(secret, timestamp, body), "hex");
  const given = /^[0-9a-f]{64}$/i.test(signature) ? Buffer.from(signature, "hex") : null;
  const matches =
    given !== null && given.length === expected.length && timingSafeEqual(given, expected);
  if (!matches) return "bad";
  return Math.abs(nowMs / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS ? "stale" : "ok";
}
