// F-244 (audyt: sitemap.xml zwracal 404): mapa strony z tych samych danych co sklep - strony stale, kategorie,
// karty produktow (listing z API) i poradniki. Adresy z PUBLIC_SITE_URL (lib/site.ts). Strona ma noindex
// (sklep demonstracyjny), mapa pokazuje warsztat SEO. Brak API = mapa samych stron stalych (bez bledu 500).
import type { MetadataRoute } from "next";
import { getCategories, getGuides, getListing } from "../lib/api";
import { absoluteUrl } from "../lib/site";

export const dynamic = "force-dynamic";

const STATIC = [
  "/",
  "/zbuduj-set",
  "/stworz-set",
  "/poradnik",
  "/faq",
  "/kontakt",
  "/o-sklepie",
  "/dostawa-i-platnosci",
  "/zwroty-i-reklamacje",
  "/regulamin",
  "/polityka-prywatnosci",
  "/cookies",
  "/zuzyty-sprzet",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC.map((path) => ({ url: absoluteUrl(path) }));
  try {
    const categories = await getCategories();
    for (const c of categories) {
      entries.push({ url: absoluteUrl(`/${c.slug}`) });
      const list = await getListing({ category: c.id, filters: {}, sort: "polecane", limit: 48 });
      for (const p of list.items) entries.push({ url: absoluteUrl(`/${c.slug}/${p.slug}`) });
    }
    for (const g of await getGuides()) entries.push({ url: absoluteUrl(`/poradnik/${g.slug}`) });
  } catch {
    /* mapa stron stalych wystarczy, gdy API jest niedostepne */
  }
  return entries;
}
