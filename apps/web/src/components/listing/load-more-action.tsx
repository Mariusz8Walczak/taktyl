"use server";
// F-026 (docs/02 §3): akcja serwerowa "Pokaz wiecej". Przeglądarka nie woła API wprost (WEB-002), wiec kolejna partia
// kart jest pobierana i renderowana na serwerze (kursor z API, znaczniki jak strona listingu) i wraca jako RSC.
import { categoryIdSchema } from "@taktyl/contracts";
import { getCategoryBySlug, getFacets, getListing } from "../../lib/api";
import { facetDefs, parseQuery, toApiFilters } from "../../lib/catalog/listing-query";
import { Cards } from "./cards";

export interface LoadMoreInput {
  category: string;
  /** `window.location.search` listingu (filtry i sortowanie; `strona` jest ignorowane). */
  search: string;
  cursor: string;
  /** Liczba kart juz na liscie (pozycja `index` w zdarzeniach). */
  startIndex: number;
}

export async function loadMoreCards(input: LoadMoreInput) {
  const category = categoryIdSchema.parse(input.category);
  if (input.search.length > 600 || input.cursor.length > 512 || input.cursor.length === 0)
    throw new Error("Niepoprawne zadanie.");
  const cat = await getCategoryBySlug(category);
  if (!cat) throw new Error("Nieznana kategoria.");

  const base = await getFacets(category);
  const defs = facetDefs(base.facets);
  const params = Object.fromEntries(new URLSearchParams(input.search));
  const query = parseQuery(params, defs, category);
  const res = await getListing({
    category,
    filters: toApiFilters(query.filters, base.facets),
    sort: query.sort,
    cursor: input.cursor,
    limit: 12,
  });
  return {
    nodes: (
      <Cards cards={res.items} categoryName={cat.name} startIndex={Math.max(0, input.startIndex)} />
    ),
    nextCursor: res.next_cursor,
    count: res.items.length,
  };
}
