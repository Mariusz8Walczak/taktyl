// B-301, B-302, B-304, B-306 (docs/04 par. 7-8, docs/15 par. 9, docs/11): walidatory tresci - czyste funkcje bez I/O.
// Opisy: zakazane slowa i dlugosc to OSTRZEZENIA (nie blokada). Tresci prawne, opinie: bledy 422 z wskazaniem miejsca.
import type { ProblemFieldError } from "@taktyl/contracts";

export interface RuleWarning {
  code:
    | "description_length"
    | "description_paragraphs"
    | "description_forbidden_words"
    | "guide_length";
  message: string;
  details?: string[];
}

/** docs/04 par. 7 i scripts/validate-descriptions.mjs: odmiana przez \p{L}*, "ultra-" jako przedrostek. */
export const FORBIDDEN_WORDS =
  /(najlepsz\p{L}*|rewolucyjn\p{L}*|profesjonaln\p{L}*|premium|idealn\p{L}*|niesamowit\p{L}*|ultra-)/giu;

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

export const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

export const DESCRIPTION_WORDS = { min: 60, max: 120 } as const;
export const DESCRIPTION_PARAGRAPHS = { min: 2, max: 3 } as const;
export const GUIDE_WORDS = { min: 600, max: 900 } as const;

/** Zakazane slowa z docs/04 par. 7 (unikalne, w kolejnosci wystapienia). */
export function forbiddenWords(text: string): string[] {
  return [...new Set([...text.matchAll(FORBIDDEN_WORDS)].map((m) => m[0].toLowerCase()))];
}

/** B-301: ostrzezenia o opisie produktu (60-120 slow, 2-3 akapity, zakazane slowa). Nigdy nie blokuje zapisu. */
export function describeDescription(text: string): {
  words: number;
  paragraphs: number;
  warnings: RuleWarning[];
} {
  const words = countWords(text);
  const paragraphs = splitParagraphs(text).length;
  const warnings: RuleWarning[] = [];
  if (words < DESCRIPTION_WORDS.min || words > DESCRIPTION_WORDS.max) {
    warnings.push({
      code: "description_length",
      message: `Opis ma ${words} slow; zalecane ${DESCRIPTION_WORDS.min}-${DESCRIPTION_WORDS.max}.`,
    });
  }
  if (paragraphs < DESCRIPTION_PARAGRAPHS.min || paragraphs > DESCRIPTION_PARAGRAPHS.max) {
    warnings.push({
      code: "description_paragraphs",
      message: `Opis ma ${paragraphs} akapitow; zalecane ${DESCRIPTION_PARAGRAPHS.min}-${DESCRIPTION_PARAGRAPHS.max}.`,
    });
  }
  const found = forbiddenWords(text);
  if (found.length > 0) {
    warnings.push({
      code: "description_forbidden_words",
      message: `Opis zawiera zakazane slowa: ${found.join(", ")}.`,
      details: found,
    });
  }
  return { words, paragraphs, warnings };
}

/** B-304: artykul poradnika 600-900 slow (ostrzezenie). Liczone z tekstu bez znacznikow HTML i skladni Markdown. */
export function guideWarnings(bodyMd: string): RuleWarning[] {
  const plain = bodyMd
    .replace(/<[^>]*>/g, " ")
    .replace(/[#>*_`|-]+/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const words = countWords(plain);
  return words < GUIDE_WORDS.min || words > GUIDE_WORDS.max
    ? [
        {
          code: "guide_length",
          message: `Artykul ma ${words} slow; wymagane ${GUIDE_WORDS.min}-${GUIDE_WORDS.max}.`,
        },
      ]
    : [];
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split("\n").length;

const ODR = /ec\.europa\.eu\/consumers\/odr|\bplatform\p{L}*\s+ODR\b|\bODR\b/giu;
const ID_WITH_NUMBER = /\b(NIP|REGON|KRS|BDO)\b\s*[:-]?\s*\d[\d -]{5,}/gi;
const NIP_LIKE = /\b\d{3}[- ]\d{3}[- ]\d{2}[- ]\d{2}\b|\b\d{10}\b/g;
const EMAIL = /[^\s@<>"()[\]]+@([^\s@<>"()[\],;]+)/g;
/** Numer telefonu PL: 3-3-3 albo 2-3-2-2 cyfr (z opcjonalnym +48); daty i godziny nie pasuja. */
const PHONE =
  /(?<!\d)(?:\+48[ -]?)?(?:\d{3}[ -]?\d{3}[ -]?\d{3}|\d{2}[ -]?\d{3}[ -]?\d{2}[ -]?\d{2})(?!\d)/g;

/**
 * B-306: tresci prawne i informacyjne - brak odnosnika do platformy ODR, brak numerow NIP/REGON/KRS/BDO, e-maile tylko
 * @taktyl.example, telefony tylko fikcyjne. Blad wskazuje linie (`body_md`, "linia N").
 */
export function legalContentErrors(text: string, path = "body_md"): ProblemFieldError[] {
  const errors: ProblemFieldError[] = [];
  const add = (index: number, code: string, message: string): void => {
    errors.push({ path, code, message: `${message} (linia ${lineOf(text, index)})` });
  };
  for (const m of text.matchAll(ODR)) {
    add(m.index ?? 0, "odr_link", "Usun odnosnik do platformy ODR (sklep jest fikcyjny)");
  }
  for (const m of text.matchAll(ID_WITH_NUMBER)) {
    add(
      m.index ?? 0,
      "forbidden_identifier",
      `Usun numer ${m[1]?.toUpperCase()}, wpisz „— (sklep fikcyjny)”`,
    );
  }
  for (const m of text.matchAll(NIP_LIKE)) {
    add(m.index ?? 0, "forbidden_identifier", "Usun numer przypominajacy NIP lub REGON");
  }
  for (const m of text.matchAll(EMAIL)) {
    if (!m[1] || m[1].toLowerCase().replace(/[.)]+$/, "") !== "taktyl.example") {
      add(m.index ?? 0, "invalid_domain", "Uzyj adresu w domenie taktyl.example");
    }
  }
  for (const m of text.matchAll(PHONE)) {
    const digits = m[0].replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "");
    if (!/0{7}$/.test(digits)) {
      add(m.index ?? 0, "real_phone", "Uzyj numeru fikcyjnego, np. +48 22 000 00 00");
    }
  }
  return errors;
}

export interface ReviewInput {
  author: string;
  date: string;
  rating: number;
  variant_label: string;
  text: string;
}

/** Autor to imie i inicjal ("Ola K."). */
export const REVIEW_AUTHOR = /^\p{Lu}\p{Ll}+ \p{Lu}\.$/u;
const AUTHENTICITY =
  /(zweryfikowan\p{L}*|potwierdzon\p{L}* (?:zakup|zamowieni)\p{L}*|prawdziw\p{L}* opini\p{L}*|opinia klienta)/iu;

/** Najwczesniejsza dozwolona data opinii: 6 miesiecy wstecz (docs/04 par. 8). */
export function earliestReviewDate(now: Date): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - 6);
  return d.toISOString().slice(0, 10);
}

/** B-302: walidacja jednej opinii; `allowedLabels` to etykiety istniejacych wariantow produktu. */
export function reviewErrors(
  index: number,
  r: ReviewInput,
  ctx: { today: string; earliest: string; allowedLabels: ReadonlySet<string> },
): ProblemFieldError[] {
  const p = `items[${index}]`;
  const errors: ProblemFieldError[] = [];
  const err = (field: string, code: string, message: string): void => {
    errors.push({ path: `${p}.${field}`, code, message });
  };
  if (!REVIEW_AUTHOR.test(r.author)) {
    err("author", "invalid_author", "Autor to imie i inicjal, np. „Ola K.”.");
  }
  if (r.date > ctx.today) err("date", "future_date", "Data opinii nie moze byc z przyszlosci.");
  else if (r.date < ctx.earliest) {
    err("date", "too_old", "Data opinii moze siegac najwyzej 6 miesiecy wstecz.");
  }
  if (!ctx.allowedLabels.has(r.variant_label)) {
    err(
      "variant_label",
      "unknown_variant_label",
      "Wariant musi odpowiadac istniejacemu wariantowi produktu.",
    );
  }
  const sentences = r.text.match(/[^.!?]+(?:[.!?]+|$)/g)?.filter((s) => s.trim()) ?? [];
  if (r.text.trim() === "" || sentences.length > 4 || r.text.length > 600) {
    err("text", "invalid_length", "Opinia ma od 1 do 4 zdan (do 600 znakow).");
  }
  if (AUTHENTICITY.test(r.text)) {
    err(
      "text",
      "claims_authenticity",
      "Opinia przykladowa nie moze twierdzic, ze jest prawdziwa lub zweryfikowana.",
    );
  }
  return errors;
}

/** Etykiety wariantow akceptowane w opiniach: kolor, kolor + przelacznik, kolor + rozmiar (np. „Grafit · Prog”). */
export function variantLabels(
  variants: readonly { colorLabel: string; switchName?: string | null; size?: string | null }[],
): Set<string> {
  const out = new Set<string>();
  for (const v of variants) {
    out.add(v.colorLabel);
    if (v.switchName) out.add(`${v.colorLabel} · ${v.switchName}`);
    if (v.size) out.add(`${v.colorLabel} · ${v.size.toUpperCase()}`);
  }
  return out;
}
