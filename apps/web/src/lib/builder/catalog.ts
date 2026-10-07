// F-102, F-103, F-104 (docs/03 §2, §4): model katalogu kreatora. Produkty z API (kontrakt) zamieniane raz na ksztalt
// domeny (grosze, stany) dla `evaluateFit` i `priceSet`; sortowanie, obrazy i opisy wariantow.
import type { Product as ApiProduct, Variant as ApiVariant } from "@taktyl/contracts";
import {
  buildSkuIndex,
  formatCmFromMm,
  type CategoryId,
  type ColorsConfig,
  type Product as DomainProduct,
  type ProductAttributes,
  type RulesConfig,
  type SkuEntry,
  type SkuIndex,
} from "@taktyl/domain";
import type { ManifestEntry } from "@taktyl/ui";
import { toManifestEntry, type ImageRef } from "../catalog/images";
import { isBuyable } from "../catalog/variants";

/** Produkt w ksztalcie wysylanym do wyspy kreatora: bez opisu, GPSR i zawartosci pudelka; zdjecia tylko potrzebne. */
export type BuilderProduct = Omit<
  ApiProduct,
  "description" | "in_box" | "gpsr" | "brand" | "images"
> & {
  images: ImageRef[];
};

/** Ujecie 01-34 (3/4 z przodu) jako zdjecie kafla, wycinek z gory i tekstura (docs/03 §5.2). */
export function toBuilderProduct(p: ApiProduct): BuilderProduct {
  const { description, in_box, gpsr, brand, images, ...rest } = p;
  void description;
  void in_box;
  void gpsr;
  void brand;
  return {
    ...rest,
    images: images.filter((i) => i.kind !== "packshot" || i.shot === "01-34"),
  } as BuilderProduct;
}

export interface ColorInfo {
  id: string;
  label: string;
  swatch: string;
  harmony: string;
  code: string;
}
export interface SwitchInfo {
  id: string;
  name: string;
  type_label: string;
  force_g: number;
  sound: string;
}
export interface PresetInfo {
  id: string;
  name: string;
  profile: string;
  note: string;
  skus: string[];
  sum_gr: number;
  set_discount_gr: number;
  total_gr: number;
}

export interface BuilderData {
  products: BuilderProduct[];
  colors: ColorInfo[];
  switches: SwitchInfo[];
  rules: RulesConfig;
  presets: PresetInfo[];
  setDiscount: { percent: number; categories: string[] };
}

export interface BuilderModel extends BuilderData {
  domainProducts: DomainProduct[];
  index: SkuIndex;
  colorsConfig: ColorsConfig;
  bySku: ReadonlyMap<string, { product: BuilderProduct; variant: ApiVariant }>;
  byId: ReadonlyMap<string, BuilderProduct>;
}

/** Atrybuty z wszystkich kategorii jako opcjonalne pola (kategoria rozstrzyga, ktore istnieja). */
export interface LooseAttrs {
  size?: string;
  size_label?: string;
  connectivity?: string[];
  weight_g?: number;
  shape?: string;
  hand_cm?: [number, number];
  surface?: string;
  sizes?: Partial<Record<string, { label: string; w: number; d: number; type: "mysz" | "biurko" }>>;
  dims_mm?: { w: number; d: number; h: number };
}

export function attrs(p: BuilderProduct): LooseAttrs {
  return p.attributes as LooseAttrs;
}

export function toDomainProduct(p: BuilderProduct): DomainProduct {
  return {
    id: p.id,
    slug: p.slug,
    category: p.category,
    name: p.name,
    short: p.short,
    attributes: p.attributes as unknown as ProductAttributes,
    defaultVariant: p.default_variant_sku,
    badges: p.badges,
    fit: p.fit,
    variants: p.variants.map((v) => ({
      sku: v.sku,
      color: v.color,
      ...(v.switch !== null ? { switch: v.switch } : {}),
      ...(v.size !== null ? { size: v.size } : {}),
      price: v.price_gr,
      regularPrice: null,
      lowest30d: v.lowest_30d_gr,
      // wylaczony wariant nie jest dostepny (tak samo jak brak stanu)
      stock: v.status === "active" ? v.stock : 0,
    })),
  };
}

export function createModel(data: BuilderData): BuilderModel {
  const domainProducts = data.products.map(toDomainProduct);
  const bySku = new Map<string, { product: BuilderProduct; variant: ApiVariant }>();
  const byId = new Map<string, BuilderProduct>();
  for (const product of data.products) {
    byId.set(product.id, product);
    for (const variant of product.variants) bySku.set(variant.sku, { product, variant });
  }
  const colorsConfig: ColorsConfig = {};
  for (const c of data.colors)
    colorsConfig[c.id] = { code: c.code, label: c.label, harmony: c.harmony, swatch: c.swatch };
  return {
    ...data,
    domainProducts,
    index: buildSkuIndex(domainProducts),
    colorsConfig,
    bySku,
    byId,
  };
}

export function entryOf(model: BuilderModel, sku: string | null): SkuEntry | null {
  return sku === null ? null : (model.index.get(sku) ?? null);
}

export function colorLabel(model: BuilderModel, id: string): string {
  return model.colors.find((c) => c.id === id)?.label ?? id;
}

/** Opis wariantu do podsumowania i pomiaru: "Grafit · Próg", "Grafit · XL". */
export function variantText(
  model: BuilderModel,
  product: BuilderProduct,
  variant: ApiVariant,
): string {
  const parts = [colorLabel(model, variant.color)];
  if (variant.switch !== null)
    parts.push(model.switches.find((s) => s.id === variant.switch)?.name ?? variant.switch);
  if (variant.size !== null) {
    parts.push(attrs(product).sizes?.[variant.size]?.label ?? variant.size);
  }
  return parts.join(" · ");
}

/** Najtansza dostepna cena modelu ("od X zl"); gdy nic nie jest na stanie - najtansza w ogole. */
export function fromPrice(p: BuilderProduct): number {
  const buyable = p.variants.filter(isBuyable);
  const list = buyable.length > 0 ? buyable : p.variants;
  return Math.min(...list.map((v) => v.price_gr));
}

export function hasStock(p: BuilderProduct): boolean {
  return p.variants.some(isBuyable);
}

/**
 * F-102 (docs/03 §2): sortowanie kafli: fit[profil] malejaco, potem cena rosnaco; bez profilu kolejnosc z katalogu
 * ("Polecane" z listingu).
 */
export function sortForStep(
  products: readonly BuilderProduct[],
  profile: string | null,
): BuilderProduct[] {
  const rank = (p: BuilderProduct): number =>
    profile === null ? 0 : ((p.fit as Record<string, number>)[profile] ?? 0);
  return products
    .map((p, i) => ({ p, i }))
    .sort((a, b) =>
      profile === null
        ? a.i - b.i
        : rank(b.p) - rank(a.p) || fromPrice(a.p) - fromPrice(b.p) || a.i - b.i,
    )
    .map((x) => x.p);
}

export function productsOf(model: BuilderModel, category: CategoryId): BuilderProduct[] {
  return model.products.filter((p) => p.category === category);
}

/** Wymiary pozycji w mm (klawiatura, myszka). */
export function dimsOf(p: BuilderProduct): { w: number; d: number } | null {
  const dims = attrs(p).dims_mm;
  return p.category === "podkladki" || !dims ? null : { w: dims.w, d: dims.d };
}

/** Szerokosc w cm dla kafla ("32,7 cm"). */
export function widthCm(p: BuilderProduct): string | null {
  const d = dimsOf(p);
  return d ? `${formatCmFromMm(d.w)}\u00A0cm` : null;
}

// ---- obrazy (docs/03 §5.2, docs/09) ----

/** Zdjecie kafla/podsumowania wariantu: ujecie 01-34 koloru, a gdy go nie ma - placeholder z manifestu. */
export function packshotEntry(p: BuilderProduct, variant: ApiVariant): ManifestEntry {
  const ref =
    p.images.find(
      (i) => i.kind === "packshot" && i.key === `${p.id}_${variant.images_key}_01-34`,
    ) ?? p.images.find((i) => i.kind === "packshot");
  if (ref) return toManifestEntry(ref);
  return {
    key: `${p.id}_${variant.images_key}_01-34`,
    kind: "packshot",
    shot: "01-34",
    description: "ujęcie 3/4 z przodu",
    files: [],
    status: "brak",
  };
}

/** Wycinek z gory (klawiatura, myszka) z wymiarami z atrybutow, gdy API nie zwraca wpisu. */
export function topdownEntry(p: BuilderProduct, color: string): ManifestEntry {
  const key = `${p.id}_${color}_top`;
  const dims = dimsOf(p) ?? { w: 0, d: 0 };
  const ref = p.images.find((i) => i.kind === "topdown" && i.key === key);
  const base: ManifestEntry = ref
    ? toManifestEntry(ref)
    : { key, kind: "topdown", files: [], status: "brak" };
  return { ...base, key, product_id: p.id, color, dims_mm: dims };
}

export function textureEntry(p: BuilderProduct, color: string): ManifestEntry {
  const key = `${p.id}_${color}_tekstura`;
  const ref = p.images.find((i) => i.kind === "texture" && i.key === key);
  const base: ManifestEntry = ref
    ? toManifestEntry(ref)
    : { key, kind: "texture", files: [], status: "brak" };
  return { ...base, key, product_id: p.id, color, tile_mm: 200 };
}
