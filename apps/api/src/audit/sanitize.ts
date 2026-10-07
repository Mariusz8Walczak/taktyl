// B-011 (docs/17 par. 3.6, par. 9): przed zapisem do audit_log usuwamy sekrety i maskujemy dane osobowe klienta.
// Dziennik jest tylko-dopisywany, wiec to, co tam trafi, zostaje na 365 dni.
import { maskPersonalDeep } from "../common/pii-mask.js";

/** Klucze, ktorych wartosci sa sekretami: usuwane z before/after (haslo, hash, token, sekret, ciasteczko, CSRF). */
const SECRET_KEY = /pass(word|wd)?|hash|token|secret|csrf|cookie|authorization|api[_-]?key/i;

/** Pola z danymi osobowymi KLIENTA zamowienia: nigdy nie trafiaja do dziennika (maskowane tak jak dla viewer). */
const CUSTOMER_KEYS = new Set([
  "contact_email",
  "contact_phone",
  "phone",
  "name",
  "nip",
  "street",
  "address",
  "postcode",
  "city",
  "shipping_address",
  "invoice",
  "contact",
]);

export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[obciete]";
  if (Array.isArray(value)) return value.map((v) => sanitizeForAudit(v, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      if (CUSTOMER_KEYS.has(k)) {
        out[k] = "[ukryte]";
        continue;
      }
      out[k] = sanitizeForAudit(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Dla roli viewer (docs/15 par. 3: "pelny, bez wartosci pol osobowych"): maskuje takze e-maile kont personelu. */
export const maskAuditValueForViewer = maskPersonalDeep;
