// F-021, F-022, F-023 (docs/04 §6): stan listingu <-> adres <-> zadanie do API. Cala logika parsowania i serializacji
// siedzi w @taktyl/domain (parseListingQuery, serializeListingQuery); tu tylko dopasowanie do ksztaltu facetow z API.
// Adres niesie ceny w zlotych (`cena=300-700`), API przyjmuje grosze (docs/16 §1).
import type { FacetsResponse } from "@taktyl/contracts";
import {
  parseListingQuery,
  serializeListingQuery,
  type FacetDef,
  type FilterState,
  type ListingQuery,
  type SortKey,
} from "@taktyl/domain";

export type Facet = FacetsResponse["facets"][number];
export type NextSearchParams = Record<string, string | string[] | undefined>;

/** Definicje filtrow dla parsera adresu: z odpowiedzi API (id, etykieta, typ, dozwolone wartosci). */
export function facetDefs(facets: readonly Facet[]): FacetDef[] {
  return facets.map((f) => {
    const def: FacetDef = { id: f.id, label: f.label, type: f.type, attr: "" };
    if (f.type === "multi" || f.type === "buckets") {
      def.values = f.values.map((v) => ({ v: v.v, label: v.label }));
    }
    return def;
  });
}

function firstValues(sp: NextSearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: "polecane", label: "Polecane" },
  { value: "cena-rosnaco", label: "Cena rosnąco" },
  { value: "cena-malejaco", label: "Cena malejąco" },
  { value: "nowosci", label: "Nowości" },
  { value: "najlzejsze", label: "Najlżejsze" },
];

/** F-024: "Najlzejsze" tylko dla myszek. */
export function sortOptionsFor(category: string) {
  return SORT_OPTIONS.filter((o) => o.value !== "najlzejsze" || category === "myszki");
}

/** F-022: widok z parametrow adresu (nieznane wartosci pomijane, `najlzejsze` poza myszkami = `polecane`). */
export function parseQuery(
  sp: NextSearchParams,
  defs: readonly FacetDef[],
  category: string,
): ListingQuery {
  const q = parseListingQuery(firstValues(sp), defs);
  return q.sort === "najlzejsze" && category !== "myszki" ? { ...q, sort: "polecane" } : q;
}

/** Adres: "?rozmiar=75&lacznosc=bt" albo "" (wartosci domyslne pomijane). */
export function toSearch(query: ListingQuery, defs: readonly FacetDef[]): string {
  const params = new URLSearchParams(serializeListingQuery(query, defs));
  const s = params.toString();
  // przecinki w listach wartosci zostaja czytelne (?rozmiar=75,tkl), jak w docs/04 §6
  return s === "" ? "" : `?${s.replace(/%2C/gi, ",")}`;
}

const DLON = /^\d{2}(?:\.\d)?$/;
/** Wartosc listy w ksztalcie przyjmowanym przez API (contracts: male litery, cyfry, kropka, myslnik). */
const API_VALUE = /^[a-z0-9.]+(?:-[a-z0-9.]+)*$/;

/**
 * Filtry z adresu -> parametry API. `cena` w groszach; brakujacy koniec zakresu = granica z facetu.
 * Wartosci spoza formatu API sa pomijane, zeby strona nigdy nie dostala 400 przez reczny adres.
 */
export function toApiFilters(
  filters: FilterState,
  facets: readonly Facet[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const facet of facets) {
    const value = filters[facet.id];
    if (value === undefined || value === false) continue;
    if (Array.isArray(value)) {
      // Wartosc spoza ksztaltu API (np. rozmiar myszki "S") dalaby 400 i 500 strony: pomijana (WEB-010).
      const ok = value.filter((v) => API_VALUE.test(v));
      if (ok.length > 0) out[facet.id] = ok.join(",");
    } else if (value === true) {
      out[facet.id] = "1";
    } else if (typeof value === "number") {
      const text = String(Math.round(value * 10) / 10);
      if (DLON.test(text)) out[facet.id] = text;
    } else if (facet.type === "range") {
      const min = value.min ?? facet.min_gr;
      const max = value.max ?? facet.max_gr;
      out[facet.id] = `${Math.min(min, max)}-${Math.max(min, max)}`;
    }
  }
  return out;
}

/** Liczba aktywnych filtrow (przycisk "Filtry (2)"): kazda wybrana wartosc liczy sie osobno. */
export function activeFilterCount(filters: FilterState): number {
  let n = 0;
  for (const v of Object.values(filters)) {
    if (Array.isArray(v)) n += v.length;
    else if (v !== undefined && v !== false) n += 1;
  }
  return n;
}
