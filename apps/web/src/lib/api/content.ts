// F-076, F-220, F-221 (docs/16 §2, docs/14 §6): odczyt tresci i opinii dla komponentow serwerowych.
// Znaczniki: `content:guide` (lista), `content:{slug}` (artykul i strona), `content:faq`, `reviews:{slug}`.
import {
  contentPageSchema,
  faqSchema,
  guideListSchema,
  reviewsResponseSchema,
  searchResponseSchema,
} from "@taktyl/contracts";
import { cache } from "react";
import { apiGet } from "./client";
import { ApiError } from "./errors";
import { TAG } from "./tags";

type ContentPage = typeof contentPageSchema._output;
export type GuideSummary = (typeof guideListSchema._output)["items"][number];
export type FaqItem = (typeof faqSchema._output)["items"][number];
export type ReviewsResponse = typeof reviewsResponseSchema._output;
export type SearchResponse = typeof searchResponseSchema._output;

export const getGuides = cache(async (): Promise<GuideSummary[]> => {
  const res = await apiGet("/v1/content/guides", guideListSchema, { tags: [TAG.contentGuide] });
  return res.items;
});

async function nullOn404<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

/** Artykul poradnika; null, gdy go nie ma (strona wola notFound()). */
export const getGuide = cache((slug: string): Promise<ContentPage | null> =>
  nullOn404(() =>
    apiGet(`/v1/content/guides/${encodeURIComponent(slug)}`, contentPageSchema, {
      tags: [TAG.content(slug), TAG.contentGuide],
    }),
  ),
);

/** Strona informacyjna (np. kontakt); null, gdy jej nie ma. */
export const getContentPage = cache((slug: string): Promise<ContentPage | null> =>
  nullOn404(() =>
    apiGet(`/v1/content/pages/${encodeURIComponent(slug)}`, contentPageSchema, {
      tags: [TAG.content(slug)],
    }),
  ),
);

export const getFaq = cache(async (): Promise<FaqItem[]> => {
  const res = await apiGet("/v1/content/faq", faqSchema, { tags: [TAG.contentFaq] });
  return res.items;
});

/** Opinie demo produktu; null dla nieznanego lub ukrytego produktu. Karta produktu nie pada przez opinie. */
export const getReviews = cache((slug: string): Promise<ReviewsResponse | null> =>
  nullOn404(() =>
    apiGet(`/v1/products/${encodeURIComponent(slug)}/reviews`, reviewsResponseSchema, {
      tags: [TAG.reviews(slug)],
    }),
  ),
);

/** F-007: wyniki wyszukiwania (bez cache: zalezy od wpisanego tekstu). */
export function getSearch(q: string, limit = 20): Promise<SearchResponse> {
  return apiGet("/v1/search", searchResponseSchema, {
    tags: [TAG.catalog],
    revalidate: false,
    query: { q, limit },
  });
}
