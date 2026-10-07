// B-102, B-103, B-111 (docs/04 par. 3.1 i 4, docs/15 par. 7.2): reguly produktu i wariantu - czyste funkcje bez I/O.
// Atrybuty walidowane schematem Zod per kategoria, opcje zgodne z kategoria, SKU zgodny ze wzorem i kodami kolor/przelacznik.
import {
  attributesSchemaByCategory,
  type CategoryId,
  type ProblemFieldError,
} from "@taktyl/contracts";
import { issuePath } from "../common/zod.pipe.js";

export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  klawiatury: "k",
  myszki: "m",
  podkladki: "p",
};

export const EXPECTED_OPTIONS: Record<CategoryId, readonly string[]> = {
  klawiatury: ["color", "switch"],
  myszki: ["color"],
  podkladki: ["size", "color"],
};

/** Stan <= 3 to "Ostatnie sztuki" (docs/04 par. 5.3); filtr "niski stan" na liscie produktow. */
export const LOW_STOCK_MAX = 3;

export const GPSR_CONTACT_DOMAIN = "@taktyl.example";

/**
 * B-102: atrybuty po zmianie. `patch` jest scalany plytko z `current`, calosc walidowana schematem kategorii; nieznane klucze
 * (literowki) to blad, nie ciche odrzucenie. Zwraca atrybuty do zapisu albo liste bledow z sciezkami `attributes.pole`.
 */
export function mergeAttributes(
  category: CategoryId,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): { ok: true; value: Record<string, unknown> } | { ok: false; errors: ProblemFieldError[] } {
  const merged = { ...current, ...patch };
  const parsed = attributesSchemaByCategory[category].safeParse(merged);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        path: issuePath(["attributes", ...i.path]),
        code: i.code,
        message: i.message,
      })),
    };
  }
  const known = new Set(Object.keys(attributesSchemaByCategory[category].shape));
  const unknown = Object.keys(merged).filter((k) => !known.has(k));
  if (unknown.length > 0) {
    return {
      ok: false,
      errors: unknown.map((k) => ({
        path: `attributes.${k}`,
        code: "unrecognized_key",
        message: "Nieznany atrybut tej kategorii.",
      })),
    };
  }
  return { ok: true, value: parsed.data as Record<string, unknown> };
}

/** B-102: kontakt GPSR wylacznie w domenie taktyl.example (regula 5). */
export function gpsrErrors(gpsr: { contact: string }): ProblemFieldError[] {
  return gpsr.contact.trim().toLowerCase().endsWith(GPSR_CONTACT_DOMAIN)
    ? []
    : [
        {
          path: "gpsr.contact",
          code: "invalid_domain",
          message: "Uzyj adresu w domenie taktyl.example.",
        },
      ];
}

/** B-111: identyfikator produktu zaczyna sie od litery kategorii (k-, m-, p-), jak w danych. */
export function productIdErrors(category: CategoryId, id: string): ProblemFieldError[] {
  return id.startsWith(`${CATEGORY_PREFIX[category]}-`)
    ? []
    : [
        {
          path: "id",
          code: "invalid_prefix",
          message: `Identyfikator produktu kategorii ${category} zaczyna sie od "${CATEGORY_PREFIX[category]}-".`,
        },
      ];
}

export function optionsErrors(
  category: CategoryId,
  options: readonly string[],
): ProblemFieldError[] {
  const expected = EXPECTED_OPTIONS[category];
  const same = options.length === expected.length && expected.every((o) => options.includes(o));
  return same
    ? []
    : [
        {
          path: "options",
          code: "invalid_options",
          message: `Opcje dla kategorii ${category}: ${expected.join(", ")}.`,
        },
      ];
}

export interface VariantParts {
  color: string;
  switch?: string | null | undefined;
  size?: string | null | undefined;
}

/**
 * B-111, B-103: kombinacja pol wariantu zgodna z kategoria (klawiatura: kolor + przelacznik; myszka: kolor; podkladka:
 * rozmiar + kolor). Bledy ze sciezkami pol wariantu.
 */
export function variantShapeErrors(category: CategoryId, v: VariantParts): ProblemFieldError[] {
  const errors: ProblemFieldError[] = [];
  const need = (path: string, present: boolean, wanted: boolean, label: string): void => {
    if (wanted && !present)
      errors.push({ path, code: "required", message: `${label} jest wymagany dla tej kategorii.` });
    if (!wanted && present)
      errors.push({ path, code: "not_allowed", message: `${label} nie dotyczy tej kategorii.` });
  };
  need("switch", Boolean(v.switch), category === "klawiatury", "Przelacznik");
  need("size", Boolean(v.size), category === "podkladki", "Rozmiar");
  return errors;
}

const SKU_SHAPES: Record<CategoryId, RegExp> = {
  klawiatury: /^K-[A-Z0-9]{2,8}-([A-Z]{3})-([A-Z]{3})$/,
  myszki: /^M-[A-Z0-9]{2,8}-([A-Z]{3})$/,
  podkladki: /^P-[A-Z0-9]{2,8}-(M|L|XL|XXL)-([A-Z]{3})$/,
};

/** B-111: SKU nowego wariantu ma prefiks kategorii i kody koloru/przelacznika/rozmiaru zgodne z polami (docs/04 par. 3.1). */
export function skuErrors(
  category: CategoryId,
  sku: string,
  codes: { colorCode: string; switchCode?: string | null; size?: string | null },
): ProblemFieldError[] {
  const m = SKU_SHAPES[category].exec(sku);
  const bad = (message: string): ProblemFieldError[] => [
    { path: "sku", code: "sku_mismatch", message },
  ];
  if (!m) return bad("SKU nie pasuje do wzoru kategorii produktu.");
  if (category === "klawiatury") {
    return m[1] === codes.colorCode && m[2] === codes.switchCode
      ? []
      : bad("Kody koloru i przelacznika w SKU nie zgadzaja sie z wybranymi.");
  }
  if (category === "myszki") {
    return m[1] === codes.colorCode ? [] : bad("Kod koloru w SKU nie zgadza sie z wybranym.");
  }
  return m[1] === codes.size?.toUpperCase() && m[2] === codes.colorCode
    ? []
    : bad("Rozmiar i kod koloru w SKU nie zgadzaja sie z wybranymi.");
}

/** B-300..B-399 pokrewne: pola zmienione miedzy dwoma obiektami (do audytu: tylko roznice). */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
): { before: Partial<T>; after: Partial<T> } {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: b, after: a };
}
