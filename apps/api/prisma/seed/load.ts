// B-102 (docs/17 par. 6-7): wczytanie i walidacja danych zrodlowych seeda. Kwoty z zl na grosze raz, tutaj.
// Zrodlo wylacznie data/*.json, assets/manifest.json i content/pages/*.md; seed niczego nie dopisuje (ADR-0005).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { toGrosze } from "@taktyl/domain";
import type { z } from "zod";
import { parseGuide, parsePage, type SeedGuide, type SeedPage } from "./content.js";
import {
  categorySchema,
  colorsSchema,
  descriptionsSchema,
  faqFileSchema,
  facetsSchema,
  manifestSchema,
  presetSchema,
  productSchema,
  reviewsFileSchema,
  rulesSchema,
  shopSchema,
  switchSchema,
} from "./schemas.js";

export type RawProduct = z.infer<typeof productSchema>;
export type RawManifestEntry = z.infer<typeof manifestSchema>[number];

export interface SeedVariant {
  sku: string;
  productId: string;
  colorId: string;
  switchId: string | null;
  sizeKey: string | null;
  priceGr: number;
  regularPriceGr: number | null;
  lowest30dGr: number | null;
  stock: number;
  imagesKey: string;
}

export interface SeedData {
  categories: z.infer<typeof categorySchema>[];
  colors: { id: string; code: string; label: string; harmony: string; swatch: string }[];
  switches: z.infer<typeof switchSchema>[];
  products: RawProduct[];
  variants: SeedVariant[];
  facets: z.infer<typeof facetsSchema>;
  rules: z.infer<typeof rulesSchema>;
  presets: z.infer<typeof presetSchema>[];
  shop: z.infer<typeof shopSchema>;
  descriptions: Record<string, string>;
  manifest: RawManifestEntry[];
  pages: SeedPage[];
  guides: SeedGuide[];
  reviews: SeedReview[];
  faq: SeedFaq[];
}

/** F-076: opinia demo; `id` jest deterministyczny (`rv-<produkt>-<n>`), `variantLabel` to etykieta wariantu. */
export interface SeedReview {
  id: string;
  productId: string;
  author: string;
  date: Date;
  rating: number;
  variantLabel: string;
  text: string;
}

/** F-221: pytanie FAQ; `id` to `faq-<key>`, kolejnosc z pliku (`position` od 1). */
export interface SeedFaq {
  id: string;
  question: string;
  answerMd: string;
  position: number;
}

export class SeedValidationError extends Error {}

function readJson<T extends z.ZodType>(root: string, rel: string, schema: T): z.infer<T> {
  const raw = JSON.parse(readFileSync(join(root, rel), "utf8")) as unknown;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues
      .slice(0, 10)
      .map((i) => `  ${i.path.join(".") || "(korzen)"}: ${i.message}`);
    throw new SeedValidationError(`${rel}: niepoprawne dane\n${lines.join("\n")}`);
  }
  return parsed.data;
}

function fail(file: string, msg: string): never {
  throw new SeedValidationError(`${file}: ${msg}`);
}

/** B-102: czyta wszystkie pliki, waliduje schematami i spojnoscia referencji. Blad przerywa seed. */
export function loadSeedData(root: string, now?: Date): SeedData {
  const categories = readJson(root, "data/categories.json", categorySchema.array());
  const colorMap = readJson(root, "data/colors.json", colorsSchema);
  const switches = readJson(root, "data/switches.json", switchSchema.array());
  const products = readJson(root, "data/products.json", productSchema.array());
  const facets = readJson(root, "data/facets.json", facetsSchema);
  const rules = readJson(root, "data/rules.json", rulesSchema);
  const presets = readJson(root, "data/presets.json", presetSchema.array());
  const shop = readJson(root, "data/shop.json", shopSchema);
  const descriptions = readJson(root, "data/descriptions.json", descriptionsSchema);
  const manifest = readJson(root, "assets/manifest.json", manifestSchema);

  const pagesDir = join(root, "content/pages");
  const pages = readdirSync(pagesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parsePage(readFileSync(join(pagesDir, f), "utf8"), `content/pages/${f}`));

  const guidesDir = join(root, "content/guides");
  const guides = readdirSync(guidesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseGuide(readFileSync(join(guidesDir, f), "utf8"), `content/guides/${f}`));
  const reviewsRaw = readJson(root, "data/reviews.json", reviewsFileSchema);
  const faqRaw = readJson(root, "content/faq.json", faqFileSchema);

  const colors = Object.entries(colorMap).map(([id, c]) => ({ id, ...c }));
  const categoryIds = new Set(categories.map((c) => c.id));
  const colorById = new Map(colors.map((c) => [c.id, c]));
  const switchById = new Map(switches.map((s) => [s.id, s]));
  const manifestKeys = new Set<string>();
  for (const m of manifest) {
    if (manifestKeys.has(m.key)) fail("assets/manifest.json", `zdublowany klucz ${m.key}`);
    manifestKeys.add(m.key);
  }

  const variants: SeedVariant[] = [];
  const skus = new Set<string>();
  const productIds = new Set<string>();
  for (const p of products) {
    if (productIds.has(p.id)) fail("data/products.json", `zdublowany produkt ${p.id}`);
    productIds.add(p.id);
    if (!categoryIds.has(p.category))
      fail("data/products.json", `${p.id}: nieznana kategoria ${p.category}`);
    if (!p.variants.some((v) => v.sku === p.default_variant)) {
      fail(
        "data/products.json",
        `${p.id}: default_variant ${p.default_variant} nie jest wariantem produktu`,
      );
    }
    for (const v of p.variants) {
      if (skus.has(v.sku)) fail("data/products.json", `zdublowany SKU ${v.sku}`);
      skus.add(v.sku);
      const color = colorById.get(v.color);
      if (!color) fail("data/products.json", `${v.sku}: nieznany kolor ${v.color}`);
      const sw = v.switch === undefined ? null : switchById.get(v.switch);
      if (v.switch !== undefined && !sw)
        fail("data/products.json", `${v.sku}: nieznany przelacznik ${v.switch}`);
      // docs/04 par. 3.1: K-{model}-{kolor}-{przelacznik}, M-{model}-{kolor}, P-{model}-{rozmiar}-{kolor}.
      const expectedTail =
        p.category === "klawiatury"
          ? [color.code, sw?.code]
          : p.category === "myszki"
            ? [color.code]
            : [v.size?.toUpperCase(), color.code];
      if (v.sku.split("-").slice(2).join("-") !== expectedTail.join("-")) {
        fail(
          "data/products.json",
          `${v.sku}: SKU niezgodny z kolorem, przelacznikiem lub rozmiarem`,
        );
      }
      if (!p.images[v.images])
        fail("data/products.json", `${v.sku}: brak zdjec dla klucza ${v.images}`);
      if (v.lowest_30d !== null && toGrosze(v.lowest_30d) <= toGrosze(v.price)) {
        fail("data/products.json", `${v.sku}: lowest_30d musi byc wyzsze od price`);
      }
      if (
        p.attributes.sizes &&
        v.size &&
        !(v.size in (p.attributes.sizes as Record<string, unknown>))
      ) {
        fail("data/products.json", `${v.sku}: rozmiar ${v.size} spoza attributes.sizes`);
      }
      variants.push({
        sku: v.sku,
        productId: p.id,
        colorId: v.color,
        switchId: v.switch ?? null,
        sizeKey: v.size ?? null,
        priceGr: toGrosze(v.price),
        regularPriceGr: v.regular_price === null ? null : toGrosze(v.regular_price),
        lowest30dGr: v.lowest_30d === null ? null : toGrosze(v.lowest_30d),
        stock: v.stock,
        imagesKey: v.images,
      });
    }
    for (const [colorKey, set] of Object.entries(p.images)) {
      for (const key of [...set.packshots, set.topdown, set.texture]) {
        if (key !== undefined && !manifestKeys.has(key)) {
          fail(
            "data/products.json",
            `${p.id}/${colorKey}: klucz zdjecia ${key} nie wystepuje w assets/manifest.json`,
          );
        }
      }
    }
  }

  for (const m of manifest) {
    if (!productIds.has(m.product_id))
      fail("assets/manifest.json", `${m.key}: nieznany produkt ${m.product_id}`);
    if (!colorById.has(m.color))
      fail("assets/manifest.json", `${m.key}: nieznany kolor ${m.color}`);
  }
  for (const pr of presets) {
    for (const sku of pr.skus)
      if (!skus.has(sku)) fail("data/presets.json", `${pr.id}: nieznany SKU ${sku}`);
  }
  for (const id of Object.keys(descriptions)) {
    if (!productIds.has(id)) fail("data/descriptions.json", `opis dla nieznanego produktu ${id}`);
  }
  for (const cat of Object.keys(facets)) {
    if (!categoryIds.has(cat)) fail("data/facets.json", `nieznana kategoria ${cat}`);
  }
  // Strony i poradniki to jedna tabela (`content_pages.slug` UQ), wiec slug musi byc unikalny lacznie.
  const slugs = new Set<string>();
  for (const pg of pages) {
    if (slugs.has(pg.slug)) fail("content/pages", `zdublowany slug ${pg.slug}`);
    slugs.add(pg.slug);
  }
  for (const g of guides) {
    if (slugs.has(g.slug))
      fail("content/guides", `slug ${g.slug} zajety (strona lub inny poradnik)`);
    slugs.add(g.slug);
    if (!(g.profile in rules.profiles))
      fail("content/guides", `${g.slug}: profil ${g.profile} spoza data/rules.json`);
  }

  // Opinie: kazdy produkt ma wlasny zestaw; wariant z etykiety istnieje (kolor, kolor + przelacznik, kolor + rozmiar).
  const reviews: SeedReview[] = [];
  for (const id of Object.keys(reviewsRaw)) {
    if (!productIds.has(id)) fail("data/reviews.json", `opinie dla nieznanego produktu ${id}`);
  }
  for (const p of products) {
    const list = reviewsRaw[p.id];
    if (!list) fail("data/reviews.json", `brak opinii dla produktu ${p.id}`);
    const labels = new Set<string>();
    for (const v of p.variants) {
      const c = colorById.get(v.color)?.label ?? "";
      labels.add(c);
      const sw = v.switch === undefined ? undefined : switchById.get(v.switch);
      if (sw) labels.add(`${c} · ${sw.name}`);
      if (v.size) labels.add(`${c} · ${v.size.toUpperCase()}`);
    }
    list.forEach((r, i) => {
      if (!labels.has(r.variant))
        fail("data/reviews.json", `${p.id}[${i}]: wariant "${r.variant}" nie istnieje`);
      const date = new Date(`${r.date}T00:00:00Z`);
      if (now && date.getTime() > now.getTime())
        fail("data/reviews.json", `${p.id}[${i}]: data ${r.date} z przyszlosci`);
      reviews.push({
        id: `rv-${p.id}-${i + 1}`,
        productId: p.id,
        author: r.author,
        date,
        rating: r.rating,
        variantLabel: r.variant,
        text: r.text,
      });
    });
  }

  const faqKeys = new Set<string>();
  const faq: SeedFaq[] = faqRaw.map((q, i) => {
    if (faqKeys.has(q.key)) fail("content/faq.json", `zdublowany klucz ${q.key}`);
    faqKeys.add(q.key);
    return { id: `faq-${q.key}`, question: q.question, answerMd: q.answer_md, position: i + 1 };
  });

  return {
    categories,
    colors,
    switches,
    products,
    variants,
    facets,
    rules,
    presets,
    shop,
    descriptions,
    manifest,
    pages,
    guides,
    reviews,
    faq,
  };
}
