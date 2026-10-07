// F-005 (docs/04 §9): logika podpowiedzi wyszukiwarki bez React: pobranie, plaska lista opcji, podswietlenie.
// Normalizacja (l z kreska) pochodzi z @taktyl/domain, nigdy wlasna kopia (regula 7).
import { formatPLN, normalizeSearchText } from "@taktyl/domain";

/** Podpowiedzi od 2 znakow (F-005). */
export const SEARCH_MIN_CHARS = 2;
/** Odczekanie po ostatnim znaku przed zapytaniem. */
export const SEARCH_DEBOUNCE_MS = 200;
/** A-18: szkielet dopiero, gdy ladowanie trwa dluzej niz 300 ms. */
export const SEARCH_SKELETON_MS = 300;

export interface SuggestResponse {
  products: { id: string; slug: string; category: string; name: string; from_price_gr: number }[];
  categories: { id: string; slug: string; name: string }[];
  guides: { slug: string; title: string; lead: string | null }[];
}

export type SuggestGroup = "products" | "categories" | "guides";

export interface SuggestOption {
  /** Stabilny id elementu listbox (aria-activedescendant). */
  id: string;
  group: SuggestGroup;
  label: string;
  /** Dopisek po prawej (cena od). */
  hint?: string;
  href: string;
}

export const GROUP_LABEL: Record<SuggestGroup, string> = {
  products: "Produkty",
  categories: "Kategorie",
  guides: "Poradniki",
};

export class SuggestError extends Error {}

/** GET /api/search; zwraca dane albo rzuca SuggestError (siec, status, ksztalt). AbortError przechodzi dalej. */
export async function fetchSuggestions(
  query: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<SuggestResponse> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/search?q=${encodeURIComponent(query)}`, {
      signal,
      headers: { accept: "application/json" },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new SuggestError("siec", { cause });
  }
  if (!res.ok) throw new SuggestError(`status ${res.status}`);
  let json: unknown;
  try {
    json = await res.json();
  } catch (cause) {
    throw new SuggestError("json", { cause });
  }
  const j = json as Partial<SuggestResponse> | null;
  if (
    !j ||
    !Array.isArray(j.products) ||
    !Array.isArray(j.categories) ||
    !Array.isArray(j.guides)
  ) {
    throw new SuggestError("ksztalt");
  }
  return j as SuggestResponse;
}

/** Plaska lista w kolejnosci wyswietlania: produkty, kategorie, poradniki (adresy z docs/05). */
export function buildOptions(res: SuggestResponse): SuggestOption[] {
  return [
    ...res.products.map((p): SuggestOption => ({
      id: `szukaj-opcja-produkt-${p.slug}`,
      group: "products",
      label: p.name,
      hint: `od ${formatPLN(p.from_price_gr)}`,
      href: `/${p.category}/${p.slug}`,
    })),
    ...res.categories.map((c): SuggestOption => ({
      id: `szukaj-opcja-kategoria-${c.slug}`,
      group: "categories",
      label: c.name,
      href: `/${c.slug}`,
    })),
    ...res.guides.map((g): SuggestOption => ({
      id: `szukaj-opcja-poradnik-${g.slug}`,
      group: "guides",
      label: g.title,
      href: `/poradnik/${g.slug}`,
    })),
  ];
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * Podswietlenie dopasowania z normalizacja (l z kreska, ogonki): zapytanie "lupek" podswietla "Lupek" w "Lupek 65".
 * Normalizacja liczona znak po znaku, zeby indeksy zgadzaly sie z oryginalem. Bez dopasowania: caly tekst.
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return [{ text, match: false }];
  let norm = "";
  const owner: number[] = []; // indeks znaku oryginalu dla kazdego znaku znormalizowanego
  Array.from(text).reduce((offset, ch) => {
    const n = normalizeSearchText(ch);
    for (let k = 0; k < n.length; k += 1) owner.push(offset);
    norm += n;
    return offset + ch.length;
  }, 0);
  const at = norm.indexOf(needle);
  if (at < 0) return [{ text, match: false }];
  const start = owner[at] ?? 0;
  const lastOwner = owner[at + needle.length - 1] ?? text.length - 1;
  const end = lastOwner + (Array.from(text.slice(lastOwner))[0]?.length ?? 1);
  return [
    { text: text.slice(0, start), match: false },
    { text: text.slice(start, end), match: true },
    { text: text.slice(end), match: false },
  ].filter((p) => p.text.length > 0);
}

/** Adres strony wynikow (docs/05 §1, F-007; strona to TAKTYL-59). */
export function searchResultsHref(query: string): string {
  return `/szukaj?q=${encodeURIComponent(query.trim())}`;
}
