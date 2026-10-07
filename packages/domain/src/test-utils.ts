// Tylko dla testow: wczytanie data/*.json (sciezka wzgledna do roota repo). Nie jest eksportowane z pakietu.
import { readFileSync } from "node:fs";
import {
  buildShopConfig,
  buildSkuIndex,
  normalizeProduct,
  type Product,
  type RawProduct,
  type RawShop,
  type ShopConfig,
  type SkuIndex,
  type Variant,
} from "./index.js";

export function readData<T>(name: string): T {
  const url = new URL(`../../../data/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

export interface TestCatalog {
  products: Product[];
  index: SkuIndex;
  shop: ShopConfig;
  bySlug: (slug: string) => Product;
  variant: (sku: string) => Variant;
}

/** Katalog i konfiguracja sklepu wczytane z data/*.json (wartosci oczekiwane wynikaja z danych). */
export function loadCatalog(): TestCatalog {
  const products = readData<RawProduct[]>("products").map(normalizeProduct);
  const shop = buildShopConfig(readData<RawShop>("shop"));
  const index = buildSkuIndex(products);
  return {
    products,
    index,
    shop,
    bySlug: (slug) => {
      const p = products.find((x) => x.slug === slug);
      if (!p) throw new Error(`Brak produktu ${slug} w data/products.json`);
      return p;
    },
    variant: (sku) => {
      const e = index.get(sku);
      if (!e) throw new Error(`Brak SKU ${sku} w data/products.json`);
      return e.variant;
    },
  };
}
