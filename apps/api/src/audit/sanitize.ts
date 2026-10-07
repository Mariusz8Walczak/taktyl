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

/**
 * Encje bez danych osobowych klienta (katalog, tresci, ustawienia, presety): ich pola `name`, `address`, `contact` to dane
 * sklepu (nazwa produktu, fikcyjny producent GPSR), wiec nie sa maskowane w dzienniku (maskowanie dotyczy zamowien,
 * kont i zgloszen). Sekrety sa usuwane zawsze.
 */
export const NON_PERSONAL_ENTITIES: ReadonlySet<string> = new Set([
  "product",
  "variant",
  "preset",
  "content",
  "review",
  "settings",
  "revalidate",
]);

export function sanitizeForAudit(value: unknown, depth = 0, keepShopFields = false): unknown {
  if (depth > 8) return "[obciete]";
  if (Array.isArray(value)) return value.map((v) => sanitizeForAudit(v, depth + 1, keepShopFields));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      if (!keepShopFields && CUSTOMER_KEYS.has(k)) {
        out[k] = "[ukryte]";
        continue;
      }
      out[k] = sanitizeForAudit(v, depth + 1, keepShopFields);
    }
    return out;
  }
  return value;
}

/** Dla roli viewer (docs/15 par. 3: "pelny, bez wartosci pol osobowych"): maskuje takze e-maile kont personelu. */
export const maskAuditValueForViewer = maskPersonalDeep;
