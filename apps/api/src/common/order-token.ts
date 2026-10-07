// B-220 (ADR-0007, docs/17 par. 3.4): order_token. Baza trzyma tylko skrot SHA-256. Token = HMAC(sekret, numer + klucz
// idempotencji), wiec powtorzenie tego samego zadania (Idempotency-Key) zwraca ten sam token bez zapisu jawnego tokenu w bazie.
import { createHmac, timingSafeEqual } from "node:crypto";
import { sha256Hex } from "./canonical-json.js";

export function deriveOrderToken(secret: string, number: string, idempotencyKey: string): string {
  return createHmac("sha256", secret)
    .update(`order-token:${number}:${idempotencyKey}`)
    .digest("base64url");
}

export function hashOrderToken(token: string): string {
  return sha256Hex(token);
}

export function tokenMatchesHash(token: string, hash: string): boolean {
  const a = Buffer.from(hashOrderToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
