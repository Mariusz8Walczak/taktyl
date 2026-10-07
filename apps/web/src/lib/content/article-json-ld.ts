// F-220: dane strukturalne Article. Bez zmyslonego autora - wydawca to sklep (Organization "Taktyl"). Bez aggregateRating.
import { absoluteUrl } from "../site";

export function articleJsonLd(input: {
  slug: string;
  title: string;
  lead: string | null;
  publishedAt: string | null;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    ...(input.lead ? { description: input.lead } : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    inLanguage: "pl-PL",
    mainEntityOfPage: absoluteUrl(`/poradnik/${input.slug}`),
    publisher: { "@type": "Organization", name: "Taktyl" },
  };
}
