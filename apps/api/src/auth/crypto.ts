// B-002 (docs/17 par. 3.6, ADR-0006): prymitywy kryptograficzne sesji. Token sesji: 32 losowe bajty, w bazie tylko SHA-256.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256Hex = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/** Losowy token (32 B, base64url, 43 znaki). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

/** HMAC-SHA256 kluczem aplikacji (SESSION_SECRET) w base64url. */
export const hmacBase64Url = (secret: string, data: string): string =>
  createHmac("sha256", secret).update(data).digest("base64url");

/** Zhashowany klucz do liczników i dziennika (e-mail, IP): HMAC, wiec bez slownika nie da sie odtworzyc wartosci. */
export const keyedHash = (secret: string, scope: "email" | "ip", value: string): string =>
  createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex").slice(0, 32);

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
