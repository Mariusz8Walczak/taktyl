// F-005, F-006: normalizacja wyszukiwania (docs/04 par. 9, pulapka 8) i synonimy mapowane na dane.
import type { Product } from "./catalog.js";

/**
 * Normalizacja zapytania i indeksu: male litery, NFD + usuniecie znakow laczacych
 * (a-ogonek, e-ogonek, o-kreska, s/c/n-kreska, z-kreska i z-kropka),
 * a litera "l" z kreska (ł) osobno, bo NFD jej nie rozklada.
 */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l");
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

// ---------------------------------------------------------------------------------------------------------------
// F-006 (TAKTYL-59): synonimy wyszukiwarki mapowane na DANE produktu (nie na tekst). Klucze po normalizacji.
// "tkl" nie potrzebuje wpisu: dopasowuje sie do rozmiaru klawiatury "tkl" w indeksie tekstowym (attributes.size).

/** "Lekka" mysz: do 60 g (zgodnie z filtrem "do 60 g" w data/facets.json). */
export const LIGHT_MOUSE_MAX_G = 60;
/** "Cicha": profil `cisza` >= 2 (docs/02, F-006). */
export const QUIET_MIN_FIT = 2;

const WIRELESS = ["bt", "2.4ghz"] as const;

function hasConnectivity(p: Product, wanted: readonly string[]): boolean {
  const c = p.attributes.connectivity;
  return Array.isArray(c) && c.some((x) => wanted.includes(x));
}

const lightMouse = (p: Product): boolean =>
  p.category === "myszki" &&
  typeof p.attributes.weight_g === "number" &&
  p.attributes.weight_g <= LIGHT_MOUSE_MAX_G;

/** "Cichy" produkt: profil `cisza` >= 2. Wspolne dla synonimu "cicha" (F-006) i zetonu "Ciche" w kreatorze (docs/03 par. 2). */
export function isQuietProduct(p: { fit: Readonly<Record<string, number | undefined>> }): boolean {
  return (p.fit.cisza ?? 0) >= QUIET_MIN_FIT;
}

const quiet = (p: Product): boolean => isQuietProduct(p);

/** F-006: slowo (znormalizowane) -> predykat produktu. */
export const SEARCH_SYNONYMS: Readonly<Record<string, (p: Product) => boolean>> = {
  bezprzewodowa: (p) => hasConnectivity(p, WIRELESS),
  bezprzewodowy: (p) => hasConnectivity(p, WIRELESS),
  bezprzewodowe: (p) => hasConnectivity(p, WIRELESS),
  cicha: quiet,
  cichy: quiet,
  ciche: quiet,
  lekka: lightMouse,
  lekki: lightMouse,
  lekkie: lightMouse,
  mata: (p) => p.category === "podkladki",
  maty: (p) => p.category === "podkladki",
  pionowa: (p) => String(p.attributes.shape ?? "").includes("pionow"),
};

/** Czy slowo zapytania jest synonimem pasujacym do produktu. */
export function matchesSynonym(token: string, product: Product): boolean {
  return Object.hasOwn(SEARCH_SYNONYMS, token) && (SEARCH_SYNONYMS[token]?.(product) ?? false);
}

/** Produkt pasuje, gdy KAZDE slowo zapytania wystepuje w tekscie produktu albo jest pasujacym synonimem. */
export function matchesProductSearch(product: Product, haystack: string, query: string): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return false;
  const text = normalizeSearchText(haystack);
  return tokens.every((t) => text.includes(t) || matchesSynonym(t, product));
}

/** Opis dopasowania przez synonim (F-006) - z danych produktu, bez wymyslania cech. */
const SYNONYM_REASON: Readonly<Record<string, (p: Product) => string>> = {
  bezprzewodowa: () => "łączność bezprzewodowa",
  bezprzewodowy: () => "łączność bezprzewodowa",
  bezprzewodowe: () => "łączność bezprzewodowa",
  cicha: () => "do cichej pracy",
  cichy: () => "do cichej pracy",
  ciche: () => "do cichej pracy",
  lekka: (p) => `waga ${String(p.attributes.weight_g ?? "")} g`,
  lekki: (p) => `waga ${String(p.attributes.weight_g ?? "")} g`,
  lekkie: (p) => `waga ${String(p.attributes.weight_g ?? "")} g`,
  mata: () => "podkładka",
  maty: () => "podkładka",
  pionowa: (p) => `kształt ${String(p.attributes.shape ?? "")}`,
};

/** Fragment opisu produktu z etykieta, np. { label: "przełącznik Szept", text: "Szept" }. */
export interface SearchPart {
  label: string;
  text: string;
}

/**
 * F-005 (audyt UX wyszukiwarki): dlaczego produkt pasuje do zapytania, gdy NIE po nazwie - pierwsza czesc opisu
 * zawierajaca slowo zapytania albo synonim (np. "przełącznik Szept", "do cichej pracy"). Null, gdy pasuje nazwa.
 * Najwyzej dwa powody, bez powtorzen.
 */
export function searchMatchReason(
  product: Product,
  parts: readonly SearchPart[],
  query: string,
): string | null {
  const name = normalizeSearchText(product.name);
  const reasons: string[] = [];
  for (const t of searchTokens(query)) {
    if (name.includes(t)) continue;
    const part = parts.find((p) => normalizeSearchText(p.text).includes(t));
    const reason = part
      ? part.label
      : matchesSynonym(t, product)
        ? (SYNONYM_REASON[t]?.(product) ?? null)
        : null;
    if (reason && !reasons.includes(reason)) reasons.push(reason);
  }
  return reasons.length > 0 ? reasons.slice(0, 2).join(" · ") : null;
}
