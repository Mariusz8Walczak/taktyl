// F-244 (docs/05 §2, docs/11 §1.2): dane strukturalne strony glownej. Organization i WebSite z nazwa; bez logo
// (brak grafiki w repo), bez adresu i telefonu (podmiot fikcyjny), bez aggregateRating i review. SearchAction
// wskazuje /szukaj?q= (strona wynikow istnieje, F-007).
import { absoluteUrl, siteUrl } from "../site";

export function homeJsonLd(): Record<string, unknown>[] {
  const url = siteUrl();
  return [
    { "@context": "https://schema.org", "@type": "Organization", name: "Taktyl", url },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Taktyl",
      url,
      inLanguage: "pl-PL",
      potentialAction: {
        "@type": "SearchAction",
        target: `${absoluteUrl("/szukaj")}?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
}
