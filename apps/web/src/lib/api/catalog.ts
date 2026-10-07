// F-020...F-026, F-060...F-072 (docs/14 §3.1, §6; docs/16 §2): odczyt katalogu dla komponentow serwerowych.
// Znaczniki wg tabeli docs/14 §6: listing `category:{slug}` + `catalog`, facety `facets:{slug}` + `catalog`,
// karta `product:{slug}` + `category:{kategoria}`, slowniki `catalog`. Odpowiedzi parsowane schematami z contracts.
import {
  categoriesResponseSchema,
  colorsResponseSchema,
  facetsResponseSchema,
  listingResponseSchema,
  productSchema,
  shippingEstimateResponseSchema,
  switchesResponseSchema,
} from "@taktyl/contracts";
import type {
  Category,
  CategoryId,
  FacetsResponse,
  ListingResponse,
  Product,
} from "@taktyl/contracts";
import type { SortKey } from "@taktyl/domain";
import { cache } from "react";
import { apiGet } from "./client";
import { ApiError } from "./errors";
import { TAG } from "./tags";

/** Parametry filtrow w ujeciu API (cena w groszach; docs/16 §1). */
export type ApiFilterQuery = Readonly<Record<string, string>>;

export const getCategories = cache(async (): Promise<Category[]> => {
  const res = await apiGet("/v1/categories", categoriesResponseSchema, { tags: [TAG.catalog] });
  return res.items;
});

/** Kategoria po adresie (slug === id w danych); null, gdy slug nie jest kategoria. */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export const getColors = cache(async () => {
  const res = await apiGet("/v1/colors", colorsResponseSchema, { tags: [TAG.catalog] });
  return res.items;
});

export const getSwitches = cache(async () => {
  const res = await apiGet("/v1/switches", switchesResponseSchema, { tags: [TAG.catalog] });
  return res.items;
});

export function getFacets(
  category: CategoryId,
  filters: ApiFilterQuery = {},
): Promise<FacetsResponse> {
  return apiGet("/v1/facets", facetsResponseSchema, {
    tags: [TAG.facets(category), TAG.catalog],
    query: { category, ...filters },
  });
}

export interface ListingParams {
  category: CategoryId;
  filters: ApiFilterQuery;
  sort: SortKey;
  limit?: number;
  cursor?: string | undefined;
}

export function getListing(p: ListingParams): Promise<ListingResponse> {
  return apiGet("/v1/products", listingResponseSchema, {
    tags: [TAG.category(p.category), TAG.catalog],
    query: {
      category: p.category,
      ...p.filters,
      sort: p.sort,
      limit: p.limit ?? 12,
      cursor: p.cursor,
    },
  });
}

/** Maks. liczba wywolan listingu przy odtwarzaniu `?strona=N` (limit API 48 na zadanie). */
const MAX_LISTING_REQUESTS = 6;

/**
 * F-026: odtwarza widok z `?strona=N`: pobiera kolejne partie kursorem, az do `count` kart.
 * Kazde wywolanie ma ten sam znacznik, wiec jest cache'owane i uniewazniane razem z kategoria.
 */
export async function getListingUpTo(
  p: Omit<ListingParams, "limit" | "cursor">,
  count: number,
): Promise<{ items: ListingResponse["items"]; nextCursor: string | null; total: number }> {
  const items: ListingResponse["items"] = [];
  let cursor: string | undefined;
  let total = 0;
  let nextCursor: string | null = null;
  for (let i = 0; i < MAX_LISTING_REQUESTS; i++) {
    const res = await getListing({ ...p, limit: Math.min(48, count - items.length), cursor });
    items.push(...res.items);
    total = res.total;
    nextCursor = res.next_cursor;
    if (items.length >= count || nextCursor === null) break;
    cursor = nextCursor;
  }
  return { items, nextCursor, total };
}

/** Produkt po slugu; 404 z API zwraca null (strona wola notFound()). */
export const getProduct = cache(
  async (slug: string, category: CategoryId): Promise<Product | null> => {
    try {
      return await apiGet(`/v1/products/${encodeURIComponent(slug)}`, productSchema, {
        tags: [TAG.product(slug), TAG.category(category)],
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
);

/** F-065: termin wysylki i dostawy liczy API (domain, Europe/Warsaw); krotki cache, bo zalezy od zegara. */
export const getShippingEstimate = cache(async (method: "kurier" | "automat" | "odbior") =>
  apiGet("/v1/shipping-estimate", shippingEstimateResponseSchema, {
    tags: [TAG.shopSettings],
    revalidate: 60,
    query: { method },
  }),
);
