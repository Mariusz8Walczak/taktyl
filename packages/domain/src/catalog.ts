// F-021, F-064, F-104: typy katalogu w domenie (ceny w groszach) i normalizacja danych z products.json.
// Wejscie z JSON-a (zlote) -> grosze dokladnie raz, tutaj (docs/04 par. 3).
import { toGrosze, type Grosze } from "./money.js";

export type CategoryId = "klawiatury" | "myszki" | "podkladki";

export interface PadSize {
  label: string;
  /** mm */
  w: number;
  /** mm */
  d: number;
  type: "mysz" | "biurko";
}

export interface ProductAttributes {
  size?: string;
  connectivity?: string[];
  dims_mm?: { w: number; d: number; h: number };
  sizes?: Record<string, PadSize>;
  hand_cm?: [number, number];
  shape?: string;
  weight_g?: number;
  [key: string]: unknown;
}

export interface Variant {
  sku: string;
  color: string;
  /** id przelacznika (tylko klawiatury) */
  switch?: string;
  /** klucz rozmiaru z attributes.sizes (tylko podkladki) */
  size?: string;
  price: Grosze;
  /** Tylko do uzytku wewnetrznego - nigdy nie jest cena przekreslona (pulapka 22). */
  regularPrice: Grosze | null;
  lowest30d: Grosze | null;
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  category: CategoryId;
  name: string;
  short: string;
  attributes: ProductAttributes;
  defaultVariant: string;
  variants: Variant[];
  badges: string[];
  fit: Record<string, number>;
}

/** Ksztalt wariantu w data/products.json (ceny w zlotych). */
export interface RawVariant {
  sku: string;
  color: string;
  switch?: string;
  size?: string;
  price: number;
  regular_price: number | null;
  lowest_30d: number | null;
  stock: number;
}

/** Ksztalt wpisu w data/products.json. */
export interface RawProduct {
  id: string;
  slug: string;
  category: CategoryId;
  name: string;
  short: string;
  attributes: ProductAttributes;
  default_variant: string;
  variants: RawVariant[];
  badges: string[];
  fit: Record<string, number>;
}

/** F-021: zamiana wpisu z JSON-a na produkt domeny (grosze). */
export function normalizeProduct(raw: RawProduct): Product {
  return {
    id: raw.id,
    slug: raw.slug,
    category: raw.category,
    name: raw.name,
    short: raw.short,
    attributes: raw.attributes,
    defaultVariant: raw.default_variant,
    badges: raw.badges,
    fit: raw.fit,
    variants: raw.variants.map((v) => {
      const variant: Variant = {
        sku: v.sku,
        color: v.color,
        price: toGrosze(v.price),
        regularPrice: v.regular_price === null ? null : toGrosze(v.regular_price),
        lowest30d: v.lowest_30d === null ? null : toGrosze(v.lowest_30d),
        stock: v.stock,
      };
      if (v.switch !== undefined) variant.switch = v.switch;
      if (v.size !== undefined) variant.size = v.size;
      return variant;
    }),
  };
}

export interface SkuEntry {
  product: Product;
  variant: Variant;
}

export type SkuIndex = ReadonlyMap<string, SkuEntry>;

/** Indeks SKU -> {produkt, wariant}; ceny koszyka liczone przy wyswietleniu (docs/03 par. 7). */
export function buildSkuIndex(products: readonly Product[]): SkuIndex {
  const index = new Map<string, SkuEntry>();
  for (const product of products) {
    for (const variant of product.variants) {
      index.set(variant.sku, { product, variant });
    }
  }
  return index;
}

/** F-064 (docs/04 par. 5.2): wariant jest w promocji, gdy lowest_30d !== null. */
export function isOnPromotion(variant: Variant): boolean {
  return variant.lowest30d !== null;
}

/**
 * F-064 (docs/04 par. 5.2): plakietka -N% = floor((lowest_30d - price) / lowest_30d * 100).
 * Liczone na groszach calkowitych; null poza promocja.
 */
export function promotionBadgePercent(variant: Variant): number | null {
  if (variant.lowest30d === null || variant.lowest30d <= 0) return null;
  const diff = variant.lowest30d - variant.price;
  if (diff <= 0) return null;
  return Math.floor((diff * 100) / variant.lowest30d);
}

export type StockLevel = "brak" | "ostatnie" | "dostepny";

/** docs/04 par. 5.3: 0 = brak, 1-3 = ostatnie sztuki, od 4 = dostepny. */
export function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return "brak";
  return stock <= 3 ? "ostatnie" : "dostepny";
}

/** docs/04 par. 5.3: maksymalna ilosc do dodania = min(stan, 10). */
export function maxOrderQuantity(stock: number): number {
  return Math.max(0, Math.min(stock, 10));
}
