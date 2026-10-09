// F-020, F-021, F-064 (B-216): migawka katalogu z bazy jako typy domeny (ceny w groszach, lowest_30d z price_history).
// Cala logika filtrow, facetow, sortowania i cen zostaje w @taktyl/domain; tu tylko mapowanie wierszy.
import { Inject, Injectable } from "@nestjs/common";
import {
  buildSkuIndex,
  type CategoryId,
  type ColorsConfig,
  type FacetDef,
  type FacetsConfig,
  type FilterContext,
  type Product,
  type RulesConfig,
  type SkuIndex,
  type Variant,
} from "@taktyl/domain";
import { CLOCK, type Clock } from "../common/clock.js";
import { PricingService } from "../pricing/pricing.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  h1: string;
  intro: string;
  position: number;
}

export interface CatalogSnapshot {
  now: Date;
  categories: CategoryRow[];
  /** Produkty aktywne z aktywnymi wariantami, kolejnosc: id rosnaco. */
  products: Product[];
  index: SkuIndex;
  facets: FacetsConfig;
  colors: ColorsConfig;
  switches: { id: string; name: string; type: string; code: string }[];
  rules: RulesConfig;
  ctx: FilterContext;
}

@Injectable()
export class CatalogLoader {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PricingService) private readonly pricing: PricingService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async load(): Promise<CatalogSnapshot> {
    const now = this.clock();
    const [categories, colorRows, switchRows, products, facetRows, rulesRow, lowest] =
      await Promise.all([
        this.prisma.category.findMany({ orderBy: { position: "asc" } }),
        this.prisma.color.findMany(),
        this.prisma.switch.findMany(),
        this.prisma.product.findMany({
          where: { status: "active" },
          include: { variants: { where: { status: "active" }, orderBy: { sku: "asc" } } },
          orderBy: { id: "asc" },
        }),
        this.prisma.facetDefinition.findMany({
          orderBy: [{ categoryId: "asc" }, { position: "asc" }],
        }),
        this.prisma.ruleSettings.findFirstOrThrow(),
        this.pricing.lowest30dBySku(now),
      ]);

    const colors: ColorsConfig = Object.fromEntries(
      colorRows.map((c) => [
        c.id,
        { code: c.code, label: c.label, harmony: c.harmony, swatch: c.swatch },
      ]),
    );
    const colorOrder = ["grafit", "mgla", "kobalt", "naturalny"];
    const orderedColors: ColorsConfig = {};
    for (const id of [
      ...colorOrder,
      ...Object.keys(colors).filter((k) => !colorOrder.includes(k)),
    ]) {
      const c = colors[id];
      if (c) orderedColors[id] = c;
    }

    const domainProducts: Product[] = products
      .filter((p) => p.variants.length > 0)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        category: p.categoryId as CategoryId,
        name: p.name,
        short: p.short,
        attributes: p.attributes as Product["attributes"],
        defaultVariant: p.defaultVariantSku ?? (p.variants[0] as { sku: string }).sku,
        badges: p.badges,
        fit: p.fit as Record<string, number>,
        variants: p.variants.map((v): Variant => {
          const variant: Variant = {
            sku: v.sku,
            color: v.colorId,
            price: v.priceGr,
            regularPrice: v.regularPriceGr,
            lowest30d: lowest.get(v.sku) ?? null,
            stock: v.stock,
          };
          if (v.switchId !== null) variant.switch = v.switchId;
          if (v.sizeKey !== null) variant.size = v.sizeKey;
          return variant;
        }),
      }));

    const facets: FacetsConfig = {};
    for (const f of facetRows) {
      const def: FacetDef = {
        id: f.id,
        label: f.label,
        type: f.type as FacetDef["type"],
        attr: f.attr,
        ...(f.unit === null ? {} : { unit: f.unit }),
        ...(f.hint === null ? {} : { hint: f.hint }),
        ...(f.values === null
          ? {}
          : { values: f.values as unknown as NonNullable<FacetDef["values"]> }),
      };
      (facets[f.categoryId] ??= []).push(def);
    }

    const switches = switchRows.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      code: s.code,
    }));
    return {
      now,
      categories,
      products: domainProducts,
      index: buildSkuIndex(domainProducts),
      facets,
      colors: orderedColors,
      switches,
      rules: {
        profiles: rulesRow.profiles as RulesConfig["profiles"],
        no_profile: rulesRow.noProfile as RulesConfig["no_profile"],
        gap_keyboard_mouse_mm: rulesRow.gapKeyboardMouseMm,
        edge_margin_mm: rulesRow.edgeMarginMm,
        checks: rulesRow.checks as RulesConfig["checks"],
      },
      ctx: {
        switches: switches.map((s) => ({ id: s.id, type: s.type })),
        colors: orderedColors,
      },
    };
  }
}
