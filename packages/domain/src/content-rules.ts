// B-301, B-304 (docs/04 par. 7, docs/15 par. 9): reguly tresci wspolne dla API i panelu - czyste funkcje bez I/O.
// Panel liczy slowa i podswietla zakazane slowa na zywo, API zwraca te same ostrzezenia po zapisie (jedno zrodlo).

/** docs/04 par. 7 i scripts/validate-descriptions.mjs: odmiana przez \p{L}*, "ultra-" jako przedrostek. */
export const FORBIDDEN_WORDS =
  /(najlepsz\p{L}*|rewolucyjn\p{L}*|profesjonaln\p{L}*|premium|idealn\p{L}*|niesamowit\p{L}*|ultra-)/giu;

export const DESCRIPTION_WORDS = { min: 60, max: 120 } as const;
export const DESCRIPTION_PARAGRAPHS = { min: 2, max: 3 } as const;
export const GUIDE_WORDS = { min: 600, max: 900 } as const;

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

export const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Zakazane slowa (unikalne, male litery, w kolejnosci wystapienia). */
export function forbiddenWords(text: string): string[] {
  return [...new Set([...text.matchAll(FORBIDDEN_WORDS)].map((m) => m[0].toLowerCase()))];
}

export interface TextSegment {
  text: string;
  /** true = zakazane slowo (do podswietlenia). */
  forbidden: boolean;
}

/** Dzieli tekst na odcinki zwykle i zakazane (podswietlenie w podgladzie opisu). */
export function segmentForbidden(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(FORBIDDEN_WORDS)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), forbidden: false });
    out.push({ text: m[0], forbidden: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), forbidden: false });
  return out;
}

/**
 * Adres dozwolony w odnosniku tresci: wzgledny, kotwica, https w domenie taktyl.example albo mailto na taktyl.example.
 * Wspolny dla sanityzacji w API i podgladu w panelu (ADM-010).
 */
const SAFE_URL =
  /^(?:\/(?![/\\])[^\s<>"']*|#[A-Za-z0-9_-]*|https:\/\/(?:[a-z0-9-]+\.)*taktyl\.example(?:[/?#][^\s<>"']*)?|mailto:[^@\s<>"']+@taktyl\.example)$/i;

export const isSafeContentUrl = (url: string): boolean => SAFE_URL.test(url.trim());
