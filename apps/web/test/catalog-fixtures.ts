// Fixtury katalogu dla testow listingu i karty produktu: produkty z data/products.json (zrodlo seedu) zamienione na
// ksztalt kontraktu API (grosze, `lowest_30d_gr`, zdjecia z assets/manifest.json). Dzieki temu S1-S8 licza sie na
// prawdziwych danych, a nie na recznie wpisanych liczbach.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Product, ProductCard } from "@taktyl/contracts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(root, rel), "utf8")) as T;

interface RawVariant {
  sku: string;
  color: string;
  switch?: string;
  size?: string;
  price: number;
  regular_price: number | null;
  lowest_30d: number | null;
  stock: number;
  images: string;
}
interface RawProduct {
  id: string;
  slug: string;
  category: string;
  name: string;
  brand: string;
  short: string;
  description: string | null;
  attributes: unknown;
  options: string[];
  default_variant: string;
  variants: RawVariant[];
  badges: string[];
  fit: unknown;
  in_box: string[];
  gpsr: unknown;
}
interface RawManifest {
  key: string;
  product_id?: string;
  kind: "packshot" | "topdown" | "texture";
  shot?: string;
  description?: string;
  files: string[];
  status: "brak" | "gotowe";
}

const rawProducts = read<RawProduct[]>("data/products.json");
const manifest = read<RawManifest[]>("assets/manifest.json");

export const COLORS = Object.entries(
  read<Record<string, { label: string; swatch: string; code: string; harmony: string }>>(
    "data/colors.json",
  ),
).map(([id, c]) => ({ id, code: c.code, label: c.label, harmony: c.harmony, swatch: c.swatch }));

export const SWITCHES =
  read<{ id: string; name: string; type_label: string; force_g: number }[]>("data/switches.json");

/** Produkt w ksztalcie odpowiedzi `GET /v1/products/{slug}` (bez `regular_price`, ceny w groszach). */
export function productFixture(slug: string, imageStatus: "brak" | "gotowe" = "brak"): Product {
  const raw = rawProducts.find((p) => p.slug === slug);
  if (!raw) throw new Error(`brak produktu ${slug} w data/products.json`);
  return {
    id: raw.id,
    slug: raw.slug,
    category: raw.category,
    name: raw.name,
    brand: "Taktyl",
    short: raw.short,
    description: raw.description,
    options: raw.options,
    default_variant_sku: raw.default_variant,
    badges: raw.badges,
    fit: raw.fit,
    in_box: raw.in_box,
    gpsr: raw.gpsr,
    attributes: raw.attributes,
    variants: raw.variants
      .map((v) => ({
        sku: v.sku,
        color: v.color,
        switch: v.switch ?? null,
        size: v.size ?? null,
        price_gr: Math.round(v.price * 100),
        lowest_30d_gr: v.lowest_30d === null ? null : Math.round(v.lowest_30d * 100),
        stock: v.stock,
        images_key: v.images,
        status: "active" as const,
      }))
      .sort((a, b) => a.sku.localeCompare(b.sku)),
    images: manifest
      .filter((m) => m.product_id === raw.id)
      .map((m) => ({
        key: m.key,
        kind: m.kind,
        shot: m.shot ?? null,
        description: m.description ?? null,
        status: imageStatus,
        files: m.files,
      })),
  } as Product;
}

/** Karta listingu liczona jak w API (apps/api card.ts): "od X zl" z najtanszego dostepnego wariantu. */
export function cardFixture(product: Product, matchedSku: string | null = null): ProductCard {
  const pool = product.variants;
  const available = pool.filter((v) => v.stock > 0);
  const base = available.length > 0 ? available : pool;
  const cheapest = [...base].sort(
    (a, b) => a.price_gr - b.price_gr || a.sku.localeCompare(b.sku),
  )[0];
  if (!cheapest) throw new Error("brak wariantow");
  return {
    id: product.id,
    slug: product.slug,
    category: product.category,
    name: product.name,
    short: product.short,
    badges: product.badges,
    from_price_gr: cheapest.price_gr,
    lowest_30d_gr: cheapest.lowest_30d_gr,
    in_stock: available.length > 0,
    default_variant_sku: product.default_variant_sku,
    matched_variant_sku: matchedSku,
    color_count: new Set(pool.map((v) => v.color)).size,
  } as ProductCard;
}
