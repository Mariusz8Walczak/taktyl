// B-060 (ADR-0003, docs/14 par. 6): zbiory znacznikow rewalidacji dla encji katalogu. Zrodlem prawdy jest tabela w docs/14 par. 6;
// kazda zmiana tutaj wymaga zmiany tej tabeli i odwrotnie (skill taktyl-admin-sklep-sync).
import { REVALIDATE_TAG_PATTERN } from "@taktyl/contracts";

export interface ProductRef {
  slug: string;
  categoryId: string;
}

const uniqSorted = (tags: string[]): string[] => [...new Set(tags)].sort();

/** Produkt (nazwa, short, atrybuty, plakietki, fit, status) i wariant (dodanie, kolor, przelacznik). */
export function productTags(p: ProductRef): string[] {
  return uniqSorted([
    `product:${p.slug}`,
    `category:${p.categoryId}`,
    "catalog",
    `facets:${p.categoryId}`,
    "presets",
  ]);
}

/** Cena wariantu (nowy wpis price_history). */
export function priceTags(p: ProductRef): string[] {
  return uniqSorted([`product:${p.slug}`, `category:${p.categoryId}`, "catalog", "presets"]);
}

/** Nowy produkt (jeszcze bez strony): lista i facety kategorii (docs/16 par. 3.2). */
export function productCreatedTags(p: ProductRef): string[] {
  return uniqSorted(["catalog", `category:${p.categoryId}`, `facets:${p.categoryId}`]);
}

/** Opinie demo i opis produktu: karta produktu. */
export function reviewTags(p: ProductRef): string[] {
  return uniqSorted([`reviews:${p.slug}`, `product:${p.slug}`]);
}

export const isValidTag = (tag: string): boolean => REVALIDATE_TAG_PATTERN.test(tag);

/** Sumuje i deduplikuje znaczniki z wielu wierszy outbox (stabilna kolejnosc). */
export function aggregateTags(groups: readonly (readonly string[])[]): string[] {
  return uniqSorted(groups.flat());
}

/** Webhook przyjmuje do 50 znacznikow naraz (revalidateTagsSchema). */
export function chunkTags(tags: readonly string[], size = 50): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < tags.length; i += size) out.push(tags.slice(i, i + size));
  return out;
}
