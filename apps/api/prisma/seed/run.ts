// B-102 (docs/17 par. 7): seed idempotentny. Wiersze wstawiane po kluczach naturalnych (id/sku/slug/code/key)
// z ON CONFLICT DO NOTHING, wiec ponowny przebieg nie dubluje i nie nadpisuje edycji z backpanelu.
// Konta admina tworzy TAKTYL-45, nie seed.
import { toGrosze } from "@taktyl/domain";
import { Prisma, type PrismaClient } from "../../src/prisma/client.js";
import { buildPriceHistory } from "./history.js";
import { loadSeedData, type SeedData } from "./load.js";

type Tx = Prisma.TransactionClient;
const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export interface SeedOptions {
  /** Katalog glowny repozytorium (data/, assets/, content/). */
  root: string;
  /** Chwila seeda; historia cen liczona wzgledem niej. Domyslnie teraz. */
  now?: Date;
  /** Najpierw wyczysc dane biznesowe (reset-demo), konta admina zostaja. */
  reset?: boolean;
  log?: (msg: string) => void;
}

export interface SeedReport {
  inserted: Record<string, number>;
}

/** Tabele, ktorych reset-demo NIE czysci (konta i sesje backpanelu, tabela migracji). */
export const RESET_KEEP_TABLES = ["admin_users", "sessions", "_prisma_migrations"];

/** B-102: reset-demo. Usuwa dane biznesowe (w tym zamowienia z danymi osobowymi, ADR-0007) i zeruje sekwencje. */
export async function resetDemoData(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const tables = rows.map((r) => r.tablename).filter((t) => !RESET_KEEP_TABLES.includes(t));
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.replace(/"/g, '""')}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  return tables;
}

/** B-102: uruchamia seed. Zwraca liczbe faktycznie wstawionych wierszy per tabela (0 = nic nowego). */
export async function runSeed(prisma: PrismaClient, opts: SeedOptions): Promise<SeedReport> {
  const log = opts.log ?? (() => undefined);
  const now = opts.now ?? new Date();
  const data = loadSeedData(opts.root);

  if (opts.reset) {
    const cleared = await resetDemoData(prisma);
    log(`reset-demo: wyczyszczono ${cleared.length} tabel`);
  }

  const inserted: Record<string, number> = {};
  await prisma.$transaction(
    async (tx) => {
      await seedAll(tx, data, now, inserted);
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
  for (const [k, v] of Object.entries(inserted)) log(`${k}: +${v}`);
  return { inserted };
}

async function seedAll(tx: Tx, d: SeedData, now: Date, ins: Record<string, number>): Promise<void> {
  const add = (name: string, r: { count: number }): void => {
    ins[name] = r.count;
  };

  // 1. Slowniki: kolory, przelaczniki, kategorie.
  add("colors", await tx.color.createMany({ data: d.colors, skipDuplicates: true }));
  add(
    "switches",
    await tx.switch.createMany({
      data: d.switches.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        type: s.type,
        typeLabel: s.type_label,
        forceG: s.force_g,
        sound: s.sound,
        summary: s.summary,
      })),
      skipDuplicates: true,
    }),
  );
  add(
    "categories",
    await tx.category.createMany({
      data: d.categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        h1: c.h1,
        intro: c.intro,
        position: c.order,
      })),
      skipDuplicates: true,
    }),
  );

  // 2. Produkty (opis z descriptions.json dopiero w kroku 3b, tylko gdy pole jest puste).
  add(
    "products",
    await tx.product.createMany({
      data: d.products.map((p) => ({
        id: p.id,
        slug: p.slug,
        categoryId: p.category,
        name: p.name,
        brand: p.brand,
        short: p.short,
        description: p.description,
        attributes: json(p.attributes),
        options: p.options,
        badges: p.badges,
        fit: json(p.fit),
        inBox: p.in_box,
        gpsr: json(p.gpsr),
      })),
      skipDuplicates: true,
    }),
  );

  // 3. Warianty, wariant domyslny, opisy.
  add(
    "variants",
    await tx.variant.createMany({
      data: d.variants.map((v) => ({
        sku: v.sku,
        productId: v.productId,
        colorId: v.colorId,
        switchId: v.switchId,
        sizeKey: v.sizeKey,
        priceGr: v.priceGr,
        regularPriceGr: v.regularPriceGr,
        stock: v.stock,
        imagesKey: v.imagesKey,
      })),
      skipDuplicates: true,
    }),
  );
  for (const p of d.products) {
    await tx.product.updateMany({
      where: { id: p.id, defaultVariantSku: null },
      data: { defaultVariantSku: p.default_variant },
    });
    const text = d.descriptions[p.id];
    if (text !== undefined) {
      await tx.product.updateMany({
        where: { id: p.id, description: null },
        data: { description: text },
      });
    }
  }

  // 4. Zdjecia (stan z manifestu).
  add(
    "product_images",
    await tx.productImage.createMany({
      data: d.manifest.map((m) => ({
        key: m.key,
        productId: m.product_id,
        colorId: m.color,
        kind: m.kind,
        shot: m.shot ?? null,
        description: m.description ?? null,
        priority: m.priority,
        status: m.status,
        files: m.files,
        dimsMm: m.dims_mm == null ? Prisma.JsonNull : json(m.dims_mm),
        pixels: m.pixels == null ? Prisma.JsonNull : json(m.pixels),
      })),
      skipDuplicates: true,
    }),
  );

  // 5. Historia cen i ruchy magazynowe: tylko dla SKU, ktore ich jeszcze nie maja.
  const withHistory = new Set(
    (await tx.priceHistory.findMany({ select: { sku: true }, distinct: ["sku"] })).map(
      (r) => r.sku,
    ),
  );
  const historyRows = d.variants
    .filter((v) => !withHistory.has(v.sku))
    .flatMap((v) =>
      buildPriceHistory({ sku: v.sku, priceGr: v.priceGr, lowest30dGr: v.lowest30dGr }, now),
    );
  add("price_history", await tx.priceHistory.createMany({ data: historyRows }));

  const withMovement = new Set(
    (
      await tx.stockMovement.findMany({
        where: { kind: "seed" },
        select: { sku: true },
        distinct: ["sku"],
      })
    ).map((r) => r.sku),
  );
  add(
    "stock_movements",
    await tx.stockMovement.createMany({
      data: d.variants
        .filter((v) => !withMovement.has(v.sku))
        .map((v) => ({
          sku: v.sku,
          delta: v.stock,
          stockAfter: v.stock,
          kind: "seed",
          reason: "seed",
          at: now,
        })),
    }),
  );

  // 6. Presety (kategoria pozycji wynika z produktu SKU; sum/set_discount/total nie sa przechowywane).
  const categoryOfSku = new Map(
    d.variants.map((v) => [v.sku, d.products.find((p) => p.id === v.productId)?.category ?? ""]),
  );
  add(
    "presets",
    await tx.preset.createMany({
      data: d.presets.map((p, i) => ({
        id: p.id,
        name: p.name,
        profile: p.profile,
        note: p.note,
        position: i + 1,
      })),
      skipDuplicates: true,
    }),
  );
  add(
    "preset_items",
    await tx.presetItem.createMany({
      data: d.presets.flatMap((p) =>
        p.skus.map((sku) => ({ presetId: p.id, categoryId: categoryOfSku.get(sku) ?? "", sku })),
      ),
      skipDuplicates: true,
    }),
  );

  // 7. Reguly i facety.
  add(
    "rule_settings",
    await tx.ruleSettings.createMany({
      data: [
        {
          id: "default",
          units: d.rules.units,
          profiles: json(d.rules.profiles),
          noProfile: json(d.rules.no_profile),
          gapKeyboardMouseMm: d.rules.gap_keyboard_mouse_mm,
          edgeMarginMm: d.rules.edge_margin_mm,
          checks: json(d.rules.checks),
          suggestionOrder: json(d.rules.suggestion_order),
          neverBlock: d.rules.never_block,
        },
      ],
      skipDuplicates: true,
    }),
  );
  add(
    "facet_definitions",
    await tx.facetDefinition.createMany({
      data: Object.entries(d.facets).flatMap(([categoryId, list]) =>
        list.map((f, i) => ({
          categoryId,
          id: f.id,
          label: f.label,
          type: f.type,
          attr: f.attr,
          values: f.values === undefined ? Prisma.JsonNull : json(f.values),
          unit: f.unit ?? null,
          hint: f.hint ?? null,
          position: i + 1,
        })),
      ),
      skipDuplicates: true,
    }),
  );

  // 8. Ustawienia sklepu (kwoty w groszach).
  const s = d.shop;
  add(
    "shop_settings",
    await tx.shopSettings.createMany({
      data: [
        {
          id: "default",
          currency: s.currency,
          locale: s.locale,
          timezone: s.timezone,
          freeShippingThresholdGr: toGrosze(s.free_shipping_threshold),
          setDiscountPercent: s.set_discount.percent,
          setDiscountCategories: s.set_discount.requires_categories,
          dispatchCutoffHour: s.dispatch.cutoff_hour,
          returnsDays: s.returns_days,
          statutoryWithdrawalDays: s.statutory_withdrawal_days,
          paymentSimulation: s.payment_simulation,
          demoLabel: s.demo.label,
          demoEmailDomain: s.demo.email_domain,
          demoPhone: s.demo.phone,
          // shop.json nie ma danych firmy; nic nie jest wymyslane (regula 4), edycja w backpanelu.
          company: {},
        },
      ],
      skipDuplicates: true,
    }),
  );
  add(
    "shipping_methods",
    await tx.shippingMethod.createMany({
      data: s.shipping_methods.map((m, i) => ({
        id: m.id,
        label: m.label,
        priceGr: toGrosze(m.price),
        etaBusinessDays: m.eta_business_days,
        fields: m.fields,
        address: m.address ?? null,
        position: i + 1,
      })),
      skipDuplicates: true,
    }),
  );
  add(
    "payment_methods",
    await tx.paymentMethod.createMany({
      data: s.payment_methods.map((m, i) => ({ id: m.id, label: m.label, position: i + 1 })),
      skipDuplicates: true,
    }),
  );
  add(
    "discount_codes",
    await tx.discountCode.createMany({
      data: s.codes.map((c) => ({
        code: c.code,
        type: c.type,
        value: c.value ?? null,
        scope: c.scope,
        label: c.label,
      })),
      skipDuplicates: true,
    }),
  );
  add(
    "pickup_points",
    await tx.pickupPoint.createMany({ data: s.pickup_points, skipDuplicates: true }),
  );

  // 9. Tresci: strony informacyjne i prawne.
  add(
    "content_pages",
    await tx.contentPage.createMany({
      data: d.pages.map((p) => ({
        slug: p.slug,
        type: "page",
        title: p.title,
        bodyMd: p.bodyMd,
        status: "published",
        demoNotice: p.demoNotice,
        publishedAt: new Date(`${p.updated}T00:00:00Z`),
      })),
      skipDuplicates: true,
    }),
  );
}
