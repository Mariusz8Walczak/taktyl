// F-069 (docs/16 §2, docs/05 §4 pkt 12): dane bloku "Dokoncz set" z `GET /v1/products/{slug}/complete-set?sku=`.
// API zwraca trzy SKU z nazwami i cena setu; tu doczytujemy pelne produkty drugiej i trzeciej kategorii (z cache
// `product:{slug}`), zeby klient mogl zmienic wariant w bloku. Brak kompletu = null (blok jest ukryty).
import { completeSetResponseSchema } from "@taktyl/contracts";
import type { CategoryId, Product } from "@taktyl/contracts";
import type { RulesConfig } from "@taktyl/domain";
import { apiGet } from "../api/client";
import { getListing, getProduct } from "../api";
import { TAG } from "../api/tags";
import { getRules } from "./data";
import { toBuilderProduct, type BuilderProduct } from "./catalog";
import type { SlotKey } from "./types";
import { CATEGORY_SLOT } from "./types";

export interface CompleteSetData {
  profile: string;
  /** SKU w kolejnosci klawiatura, myszka, podkladka. */
  skus: Record<SlotKey, string>;
  products: BuilderProduct[];
  rules: RulesConfig;
  /** Slot produktu, na ktorego karcie stoi blok. */
  anchor: SlotKey;
}

export async function loadCompleteSet(
  product: Product,
  sku: string,
): Promise<CompleteSetData | null> {
  try {
    const set = await apiGet(
      `/v1/products/${encodeURIComponent(product.slug)}/complete-set`,
      completeSetResponseSchema,
      { tags: [TAG.product(product.slug), TAG.catalog, TAG.shopSettings], query: { sku } },
    );
    const skus: Partial<Record<SlotKey, string>> = {};
    const products: BuilderProduct[] = [toBuilderProduct(product)];
    for (const item of set.items) {
      const category: CategoryId = item.sku.startsWith("K")
        ? "klawiatury"
        : item.sku.startsWith("M")
          ? "myszki"
          : "podkladki";
      skus[CATEGORY_SLOT[category]] = item.sku;
      if (category === product.category) continue;
      const list = await getListing({ category, filters: {}, sort: "polecane", limit: 48 });
      const card = list.items.find((c) => c.name === item.name);
      const full = card ? await getProduct(card.slug, category) : null;
      if (!full) return null;
      products.push(toBuilderProduct(full));
    }
    if (!skus.k || !skus.m || !skus.p || products.length !== 3) return null;
    return {
      profile: set.profile,
      skus: { k: skus.k, m: skus.m, p: skus.p },
      products,
      rules: await getRules(),
      anchor: CATEGORY_SLOT[product.category],
    };
  } catch {
    return null; // blok jest dodatkiem: brak API nie psuje karty
  }
}
