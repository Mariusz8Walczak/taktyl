// F-001, F-009 (docs/14 §6): znaczniki cache zgodne z tabela znacznikow. Dodanie znacznika tutaj bez wiersza
// w docs/14 §6 (i odwrotnie) jest bledem przegladu (skill taktyl-admin-sklep-sync).
export const TAG = {
  shopSettings: "shop-settings",
  catalog: "catalog",
  presets: "presets",
  rules: "rules",
  category: (slug: string) => `category:${slug}`,
  product: (slug: string) => `product:${slug}`,
  facets: (slug: string) => `facets:${slug}`,
  reviews: (slug: string) => `reviews:${slug}`,
  content: (slug: string) => `content:${slug}`,
  contentGuide: "content:guide",
  contentFaq: "content:faq",
} as const;

/** Siatka bezpieczenstwa ISR (docs/14 §5): odswiezanie co 300 s mimo braku webhooka. */
export const REVALIDATE_SECONDS = 300;
