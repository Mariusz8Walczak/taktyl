// F-005, F-006: normalizacja wyszukiwania (docs/04 par. 9, pulapka 8).

/**
 * Normalizacja zapytania i indeksu: male litery, NFD + usuniecie znakow laczacych
 * (a-ogonek, e-ogonek, o-kreska, s/c/n-kreska, z-kreska i z-kropka),
 * a litera "l" z kreska (ł) osobno, bo NFD jej nie rozklada.
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

/** Slowa zapytania po normalizacji (rozdzielone bialymi znakami). */
export function searchTokens(query: string): string[] {
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/** Zapytanie pasuje, gdy kazde jego slowo wystepuje w znormalizowanym tekscie (pusty tekst zapytania nie pasuje do niczego). */
export function matchesSearch(haystack: string, query: string): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return false;
  const normalized = normalizeSearchText(haystack);
  return tokens.every((t) => normalized.includes(t));
}
