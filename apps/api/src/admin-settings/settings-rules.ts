// B-400..B-408 (docs/15 par. 10, docs/16 par. 3.5, regula 5): reguly walidacji ustawien sklepu - czyste funkcje bez I/O.
// Zakresy, spojnosc metod dostawy, kody rabatowe, punkty odbioru, dane fikcyjnej firmy, etykieta demo.
import type { ProblemFieldError } from "@taktyl/contracts";

export const ALL_CATEGORIES = ["klawiatury", "myszki", "podkladki"] as const;
/** Fikcyjne adresy i lokalizacje maja oznaczenie "fikcyjn..." (regula 5; docs/04 dane przykladowe). */
export const FICTIONAL_MARK = /fikcyjn/i;
const FICTIONAL_POSTCODE = "00-000";

const err = (path: string, code: string, message: string): ProblemFieldError => ({
  path,
  code,
  message,
});

/** Kod pocztowy w tekscie to wylacznie 00-000 (adresy fikcyjne). */
export function postcodeErrors(path: string, text: string): ProblemFieldError[] {
  const bad = [...text.matchAll(/\b\d{2}-\d{3}\b/g)].some((m) => m[0] !== FICTIONAL_POSTCODE);
  return bad ? [err(path, "invalid_postcode", "Wpisz kod pocztowy w formacie 00-000.")] : [];
}

/** B-401: kategorie rabatu setu to dokladnie trzy rozne kategorie sklepu. */
export function setDiscountErrors(categories: readonly string[]): ProblemFieldError[] {
  const distinct = new Set(categories);
  const ok =
    distinct.size === ALL_CATEGORIES.length && ALL_CATEGORIES.every((c) => distinct.has(c));
  return ok
    ? []
    : [
        err(
          "set_discount.categories",
          "invalid_categories",
          "Rabat setu wymaga trzech roznych kategorii: klawiatury, myszki, podkladki.",
        ),
      ];
}

export interface ShippingInput {
  id: string;
  label: string;
  fields: readonly string[];
  address: string | null;
}

/** B-402: spojnosc pol kasy (adres: ulica, kod, miasto razem; punkt odbioru wyklucza adres; kurier wymaga adresu). */
export function shippingMethodErrors(index: number, m: ShippingInput): ProblemFieldError[] {
  const p = `shipping_methods[${index}]`;
  const errors: ProblemFieldError[] = [];
  const has = (f: string): boolean => m.fields.includes(f);
  if (new Set(m.fields).size !== m.fields.length) {
    errors.push(err(`${p}.fields`, "duplicate", "Pola w kasie nie moga sie powtarzac."));
  }
  if (!has("email") || !has("phone")) {
    errors.push(err(`${p}.fields`, "contact_required", "Kasa zawsze pyta o e-mail i telefon."));
  }
  const address = ["street", "postcode", "city"].filter(has);
  if (address.length > 0 && address.length < 3) {
    errors.push(
      err(`${p}.fields`, "incomplete_address", "Adres to ulica, kod pocztowy i miasto razem."),
    );
  }
  if (has("point") && address.length > 0) {
    errors.push(
      err(`${p}.fields`, "point_with_address", "Punkt odbioru wyklucza pola adresu dostawy."),
    );
  }
  if (m.id === "automat" && !has("point")) {
    errors.push(err(`${p}.fields`, "point_required", "Automat paczkowy wymaga wyboru punktu."));
  }
  if (m.id === "kurier" && (address.length < 3 || !has("name") || has("point"))) {
    errors.push(
      err(`${p}.fields`, "address_required", "Kurier wymaga imienia, ulicy, kodu i miasta."),
    );
  }
  if (m.label.trim() === "") {
    errors.push(err(`${p}.label`, "required", "Wpisz nazwe metody dostawy."));
  }
  if (m.address !== null) {
    if (!FICTIONAL_MARK.test(m.address)) {
      errors.push(
        err(
          `${p}.address`,
          "not_fictional",
          'Adres musi byc oznaczony jako fikcyjny, np. "(adres fikcyjny)".',
        ),
      );
    }
    errors.push(...postcodeErrors(`${p}.address`, m.address));
  }
  return errors;
}

export interface CodeInput {
  code: string;
  type: "percent" | "free_shipping";
  value: number | null;
  valid_from: string | null;
  valid_to: string | null;
}

/** B-404: kod 4-20 znakow, procent wymaga wartosci, darmowa dostawa jej nie ma, zakres dat sensowny. */
export function codeErrors(index: number, c: CodeInput): ProblemFieldError[] {
  const p = `discount_codes[${index}]`;
  const errors: ProblemFieldError[] = [];
  if (c.code.length < 4 || c.code.length > 20) {
    errors.push(err(`${p}.code`, "invalid_length", "Kod ma 4-20 znakow: wielkie litery i cyfry."));
  }
  if (c.type === "percent" && c.value === null) {
    errors.push(err(`${p}.value`, "value_required", "Kod procentowy wymaga wartosci."));
  }
  if (c.type === "free_shipping" && c.value !== null) {
    errors.push(err(`${p}.value`, "value_not_allowed", "Darmowa dostawa nie ma wartosci."));
  }
  if (c.valid_from && c.valid_to && Date.parse(c.valid_from) >= Date.parse(c.valid_to)) {
    errors.push(err(`${p}.valid_to`, "invalid_range", "Koniec waznosci musi byc po poczatku."));
  }
  return errors;
}

/** B-405: punkt odbioru - fikcyjna lokalizacja, kod pocztowy tylko 00-000. */
export function pickupErrors(
  index: number,
  pt: { city: string; label: string },
): ProblemFieldError[] {
  const p = `pickup_points[${index}]`;
  const errors: ProblemFieldError[] = [];
  if (pt.city.trim() === "") errors.push(err(`${p}.city`, "required", "Wpisz miasto."));
  if (pt.label.trim() === "") errors.push(err(`${p}.label`, "required", "Wpisz nazwe punktu."));
  if (!FICTIONAL_MARK.test(pt.label)) {
    errors.push(
      err(
        `${p}.label`,
        "not_fictional",
        'Lokalizacja musi byc oznaczona jako fikcyjna, np. "(lokalizacja fikcyjna)".',
      ),
    );
  }
  errors.push(...postcodeErrors(`${p}.label`, pt.label));
  return errors;
}

/** B-406 + regula 10: etykieta demo nie moze byc pusta i musi mowic, ze to sklep demonstracyjny. */
export function demoLabelErrors(label: string): ProblemFieldError[] {
  if (label.trim() === "")
    return [err("demo.label", "required", "Etykieta demo nie moze byc pusta.")];
  return /demo/i.test(label)
    ? []
    : [err("demo.label", "demo_required", "Etykieta musi informowac, ze to sklep demonstracyjny.")];
}

const FORBIDDEN_COMPANY_KEYS = /^(nip|regon|krs|bdo)$/i;
const NIP_LIKE = /\b\d{3}[- ]?\d{3}[- ]?\d{2}[- ]?\d{2}\b/;
const REGON_LIKE = /\b\d{9}(?:\d{5})?\b/;
const EMAIL = /[^\s@<>"]+@([^\s@<>",;]+)/g;
const PHONE = /(?:\+48[ -]?)?(?:\d[ -]?){8}\d/g;

/** B-408: dane fikcyjnej firmy - bez NIP/REGON/KRS/BDO, e-maile tylko @taktyl.example, telefony tylko 000 00 00. */
export function companyErrors(company: Record<string, string>): ProblemFieldError[] {
  const errors: ProblemFieldError[] = [];
  for (const [key, value] of Object.entries(company)) {
    const path = `company.${key}`;
    if (FORBIDDEN_COMPANY_KEYS.test(key)) {
      errors.push(
        err(
          path,
          "forbidden_identifier",
          "NIP, REGON, KRS i BDO nie wystepuja w sklepie fikcyjnym.",
        ),
      );
      continue;
    }
    if (/\b(nip|regon|krs|bdo)\b/i.test(value) || NIP_LIKE.test(value)) {
      errors.push(
        err(
          path,
          "forbidden_identifier",
          "Usun numer NIP, REGON, KRS lub BDO: sklep jest fikcyjny.",
        ),
      );
    }
    if (REGON_LIKE.test(value) && !NIP_LIKE.test(value)) {
      errors.push(
        err(path, "forbidden_identifier", "Usun numer rejestrowy (REGON): sklep jest fikcyjny."),
      );
    }
    for (const m of value.matchAll(EMAIL)) {
      if (!m[1] || m[1].toLowerCase() !== "taktyl.example") {
        errors.push(err(path, "invalid_domain", "Uzyj adresu w domenie taktyl.example."));
        break;
      }
    }
    if (/https?:\/\/(?!([^/\s]*\.)?taktyl\.example)/i.test(value)) {
      errors.push(err(path, "invalid_domain", "Uzyj adresu w domenie taktyl.example."));
    }
    for (const m of value.matchAll(PHONE)) {
      const digits = m[0].replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "");
      if (!/0{7}$/.test(digits)) {
        errors.push(err(path, "real_phone", "Uzyj numeru fikcyjnego, np. +48 22 000 00 00."));
        break;
      }
    }
    errors.push(...postcodeErrors(path, value));
  }
  return errors;
}
