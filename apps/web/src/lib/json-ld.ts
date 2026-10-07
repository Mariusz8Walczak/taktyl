// F-008, F-078: dane strukturalne (JSON-LD). Serializacja bezpieczna dla <script>: znak `<` zamieniony na <,
// zeby tresc z API nie mogla zamknac znacznika. Bez aggregateRating i review (docs/11 §1.2).
import { absoluteUrl } from "./site";

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export interface Crumb {
  label: string;
  /** Adres wzgledny; brak dla biezacej strony. */
  href?: string;
}

/** F-008: BreadcrumbList; ostatnia pozycja (biezaca strona) bez `item`. */
export function breadcrumbJsonLd(items: readonly Crumb[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: absoluteUrl(c.href) } : {}),
    })),
  };
}
