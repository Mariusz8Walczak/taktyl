// F-020...F-026, F-029, F-060...F-072, F-069 (docs/16 par. 2): katalog publiczny. Filtry, facety i sortowanie z @taktyl/domain.
import { Inject, Injectable } from "@nestjs/common";
import {
  categoriesResponseSchema,
  colorsResponseSchema,
  completeSetResponseSchema,
  facetsResponseSchema,
  listingResponseSchema,
  productSchema,
  switchesResponseSchema,
  type Filters,
  type ListingQuery,
} from "@taktyl/contracts";
import {
  computeFacets,
  filterProducts,
  listingPrice,
  parseListingQuery,
  sortListing,
  type FacetDef,
  type FilterState,
  type Product as DomainProduct,
} from "@taktyl/domain";
import { notFound, validationFailed } from "../common/app-exception.js";
import { respond } from "../common/zod.pipe.js";
import { PricingService } from "../pricing/pricing.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toCard } from "./card.js";
import { CatalogLoader, type CatalogSnapshot } from "./catalog.loader.js";
import { completeSet, priceEntries, type SetProfile } from "./complete-set.js";

const FILTER_KEYS = [
  "rozmiar",
  "przelacznik",
  "lacznosc",
  "obudowa",
  "kolor",
  "waga",
  "ksztalt",
  "reka",
  "typ",
  "powierzchnia",
  "hotswap",
  "dostepnosc",
  "cena",
  "dlon",
] as const;

/** Kursor "Pokaz wiecej" (F-026): nieprzezroczysty, koduje przesuniecie w posortowanej liscie. */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: unknown };
    if (typeof parsed.o === "number" && Number.isInteger(parsed.o) && parsed.o >= 0)
      return parsed.o;
  } catch {
    // zly kursor: blad ponizej
  }
  throw validationFailed(
    [{ path: "cursor", code: "invalid_cursor", message: "Niepoprawny kursor." }],
    400,
  );
}

/**
 * F-022: filtry z zadania API -> stan domeny. Parser adresu zostaje w domenie; API przyjmuje cene w groszach
 * (docs/16 par. 1), wiec zakres jest zamieniany na zlote tylko po to, by domena zdjela go tym samym parserem.
 */
export function toFilterState(filters: Partial<Filters>, defs: readonly FacetDef[]): FilterState {
  const params: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value === undefined) continue;
    if (key === "cena") {
      const [min, max] = (value as string).split("-").map(Number) as [number, number];
      params[key] = `${min / 100}-${max / 100}`;
    } else {
      params[key] = Array.isArray(value) ? value.join(",") : String(value);
    }
  }
  return parseListingQuery(params, defs).filters;
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CatalogLoader) private readonly loader: CatalogLoader,
    @Inject(PricingService) private readonly pricing: PricingService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private categoryProducts(snap: CatalogSnapshot, category: string): DomainProduct[] {
    if (!snap.categories.some((c) => c.id === category)) throw notFound("Nieznana kategoria.");
    return snap.products.filter((p) => p.category === category);
  }

  async categories() {
    const snap = await this.loader.load();
    return respond(categoriesResponseSchema, {
      items: snap.categories.map((c) => {
        const products = snap.products.filter((p) => p.category === c.id);
        const prices = products
          .map((p) => listingPrice(p.variants)?.price)
          .filter((x): x is number => x !== undefined);
        return {
          id: c.id,
          slug: c.slug,
          name: c.name,
          h1: c.h1,
          intro: c.intro,
          position: c.position,
          model_count: products.length,
          from_price_gr: prices.length > 0 ? Math.min(...prices) : null,
        };
      }),
    });
  }

  async listing(q: ListingQuery) {
    const snap = await this.loader.load();
    const products = this.categoryProducts(snap, q.category);
    const defs = snap.facets[q.category] ?? [];
    const state = toFilterState(q, defs);
    const offset = decodeCursor(q.cursor);
    const sorted = sortListing(filterProducts(products, defs, state, snap.ctx), q.sort);
    const variantFilterActive = defs.some(
      (d) => d.attr.startsWith("variant.") && state[d.id] !== undefined,
    );
    const page = sorted.slice(offset, offset + q.limit);
    const next = offset + q.limit < sorted.length ? encodeCursor(offset + q.limit) : null;
    return respond(listingResponseSchema, {
      items: page.map((i) => toCard(i, variantFilterActive)),
      next_cursor: next,
      total: sorted.length,
    });
  }

  async facets(q: Filters & { category: ListingQuery["category"] }) {
    const snap = await this.loader.load();
    const products = this.categoryProducts(snap, q.category);
    const defs = snap.facets[q.category] ?? [];
    const state = toFilterState(q, defs);
    const total = filterProducts(products, defs, state, snap.ctx).length;
    const handRanges = products
      .map((p) => p.attributes.hand_cm)
      .filter((h): h is [number, number] => Array.isArray(h));
    const facets = computeFacets(products, defs, state, snap.ctx).map((f) => {
      const head = { id: f.id, label: f.label };
      switch (f.type) {
        case "bool":
          return {
            ...head,
            type: "bool" as const,
            count: f.count ?? 0,
            disabled: (f.count ?? 0) === 0 && state[f.id] === undefined,
          };
        case "range":
          return {
            ...head,
            type: "range" as const,
            min_gr: f.bounds?.min ?? 0,
            max_gr: f.bounds?.max ?? 0,
          };
        case "number-match":
          return {
            ...head,
            type: "number-match" as const,
            min_cm: handRanges.length > 0 ? Math.min(...handRanges.map((h) => h[0])) : 0,
            max_cm: handRanges.length > 0 ? Math.max(...handRanges.map((h) => h[1])) : 0,
          };
        default:
          return {
            ...head,
            type: f.type,
            values: f.values.map((v) => ({
              v: v.v,
              label: v.label,
              count: v.count,
              disabled: v.disabled,
            })),
          };
      }
    });
    return respond(facetsResponseSchema, { category: q.category, total, facets });
  }

  /** F-060...F-072: pelny produkt; `sku` wybiera wariant (staje sie `default_variant_sku` odpowiedzi). */
  async product(slug: string, sku?: string) {
    const now = (await this.loader.load()).now;
    const p = await this.prisma.product.findFirst({
      where: { slug, status: "active" },
      include: { variants: { orderBy: { sku: "asc" } }, images: { orderBy: { key: "asc" } } },
    });
    if (!p) throw notFound("Nie znaleziono produktu.");
    if (sku !== undefined && !p.variants.some((v) => v.sku === sku))
      throw notFound("Nie znaleziono wariantu.");
    const lowest = await this.pricing.lowest30dBySku(
      now,
      p.variants.map((v) => v.sku),
    );
    return respond(productSchema, {
      id: p.id,
      slug: p.slug,
      category: p.categoryId,
      name: p.name,
      brand: p.brand,
      short: p.short,
      description: p.description,
      options: p.options,
      default_variant_sku: sku ?? p.defaultVariantSku ?? (p.variants[0] as { sku: string }).sku,
      badges: p.badges,
      fit: p.fit,
      in_box: p.inBox,
      gpsr: p.gpsr,
      attributes: p.attributes,
      variants: p.variants.map((v) => ({
        sku: v.sku,
        color: v.colorId,
        switch: v.switchId,
        size: v.sizeKey,
        price_gr: v.priceGr,
        lowest_30d_gr: lowest.get(v.sku) ?? null,
        stock: v.stock,
        images_key: v.imagesKey,
        status: v.status,
      })),
      images: p.images.map((i) => ({
        key: i.key,
        kind: i.kind,
        shot: i.shot,
        description: i.description,
        status: i.status,
        files: i.files,
      })),
    });
  }

  /** F-069: propozycja "Dokoncz set" (dwie pozostale kategorie wg fit, cena setu z rabatem - domena). */
  async completeSet(slug: string, profile?: SetProfile, sku?: string) {
    const snap = await this.loader.load();
    const product = snap.products.find((p) => p.slug === slug);
    if (!product) throw notFound("Nie znaleziono produktu.");
    const variant = sku
      ? product.variants.find((v) => v.sku === sku)
      : (product.variants.filter((v) => v.stock > 0).sort((a, b) => a.price - b.price)[0] ??
        product.variants[0]);
    if (!variant) throw notFound("Nie znaleziono wariantu.");
    const result = completeSet({ product, variant }, profile, snap.products, snap.rules);
    if (!result) throw notFound("Brak dostepnych pozycji do dokonczenia setu.");
    const shop = await this.prisma.shopSettings.findFirstOrThrow();
    const price = priceEntries(result.entries, shop.setDiscountPercent, shop.setDiscountCategories);
    return respond(completeSetResponseSchema, {
      profile: result.profile,
      items: result.entries.map((e) => ({
        sku: e.variant.sku,
        name: e.product.name,
        price_gr: e.variant.price,
      })),
      sum_gr: price.sum,
      set_discount_gr: price.discount,
      total_gr: price.total,
    });
  }

  async switches() {
    const rows = await this.prisma.switch.findMany({ orderBy: { code: "asc" } });
    return respond(switchesResponseSchema, {
      items: rows.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        type: s.type,
        type_label: s.typeLabel,
        force_g: s.forceG,
        sound: s.sound,
        summary: s.summary,
      })),
    });
  }

  async colors() {
    const snap = await this.loader.load();
    return respond(colorsResponseSchema, {
      items: Object.entries(snap.colors).map(([id, c]) => ({
        id,
        code: c.code,
        label: c.label,
        harmony: c.harmony,
        swatch: c.swatch,
      })),
    });
  }
}
