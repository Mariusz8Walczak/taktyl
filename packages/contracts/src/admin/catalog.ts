// B-010...B-018 (docs/16 §3.2): katalog w backpanelu. PATCH wymaga If-Match (ifMatchSchema); cena i stan to osobne PUT-y.
import { z } from "zod";
import {
  badgeSchema,
  categoryIdSchema,
  colorIdSchema,
  padSizeKeySchema,
  switchIdSchema,
  profileIdSchema,
} from "../shared/enums";
import { pageOf, pageQuerySchema } from "../shared/pagination";
import {
  dateTimeSchema,
  groszeNonNegative,
  groszePositive,
  productIdSchema,
  skuSchema,
  slugSchema,
  versionSchema,
} from "../shared/primitives";
import {
  fitSchema,
  gpsrSchema,
  categorySchema,
  imageRefSchema,
  productSchema,
  variantSchema,
  presetSchema,
} from "../public/catalog";

const nonEmptyPatch = <T extends z.ZodType>(s: T) =>
  s.refine((v) => Object.keys(v as object).length > 0, "pusty PATCH");

export const adminProductListQuerySchema = pageQuerySchema.extend({
  category: categoryIdSchema.optional(),
  status: z.enum(["active", "archived"]).optional(),
  missing_image: z.literal("1").optional(),
  low_stock: z.literal("1").optional(),
  promo: z.literal("1").optional(),
  q: z.string().trim().min(1).max(80).optional(),
  sort: z
    .string()
    .regex(/^-?[a-z_]+$/)
    .default("-updated_at"),
});
export const adminProductRowSchema = z.object({
  id: productIdSchema,
  slug: slugSchema,
  category: categoryIdSchema,
  name: z.string(),
  status: z.enum(["active", "archived"]),
  variant_count: z.int().min(0),
  from_price_gr: groszeNonNegative,
  total_stock: z.int().min(0),
  missing_images: z.int().min(0),
  badges: z.array(badgeSchema),
  on_sale: z.boolean(),
  version: versionSchema,
  updated_at: dateTimeSchema,
});
export const adminProductListSchema = pageOf(adminProductRowSchema);

/** Produkt admina = widok publiczny + status i wersja. `regular_price_gr` widoczna tylko tu (wewnetrzna). */
export const adminVariantSchema = variantSchema.extend({
  regular_price_gr: groszeNonNegative.nullable(),
  version: versionSchema,
});
export const adminProductSchema = z.intersection(
  productSchema,
  z.object({
    status: z.enum(["active", "archived"]),
    version: versionSchema,
    updated_at: dateTimeSchema,
    variants: z.array(adminVariantSchema).min(1),
  }),
);

/** Ostrzezenie (nie blokada) zwracane przy zapisie: np. produkt w gotowych setach (B-113), domyslny wariant bez stanu (B-103). */
export const adminWarningSchema = z.object({
  code: z.enum([
    "in_presets",
    "default_variant_out_of_stock",
    "description_length",
    "description_forbidden_words",
  ]),
  message: z.string(),
  details: z.array(z.string()).optional(),
});
const adminDetailExtra = {
  default_variant_sku: skuSchema.nullable(),
  status: z.enum(["active", "archived"]),
  version: versionSchema,
  updated_at: dateTimeSchema,
  variants: z.array(adminVariantSchema),
  images: z.array(imageRefSchema),
  warnings: z.array(adminWarningSchema),
};
/** Szczegoly produktu w backpanelu (B-100...B-115): widok publiczny + status, wersja, warianty z wersja i cena wewnetrzna.
 *  Nowy produkt bez wariantow ma pusta liste i status archived (docs/decyzje API-011). */
export const adminProductDetailSchema = z.discriminatedUnion("category", [
  productSchema.options[0].extend(adminDetailExtra),
  productSchema.options[1].extend(adminDetailExtra),
  productSchema.options[2].extend(adminDetailExtra),
]);
export type AdminProductDetail = z.infer<typeof adminProductDetailSchema>;

/** Atrybuty sa walidowane per kategoria po stronie API (attributesSchemaByCategory) na podstawie kategorii produktu. */
export const productPatchSchema = nonEmptyPatch(
  z.strictObject({
    name: z.string().trim().min(2).max(80).optional(),
    slug: slugSchema.optional(),
    short: z.string().trim().min(5).max(300).optional(),
    default_variant_sku: skuSchema.optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    badges: z.array(badgeSchema).max(2).optional(),
    fit: fitSchema.optional(),
    in_box: z.array(z.string().min(1).max(120)).max(20).optional(),
    gpsr: gpsrSchema.optional(),
    status: z.enum(["active", "archived"]).optional(),
  }),
);
export const productCreateSchema = z.strictObject({
  id: productIdSchema,
  slug: slugSchema,
  category: categoryIdSchema,
  name: z.string().trim().min(2).max(80),
  short: z.string().trim().min(5).max(300),
  attributes: z.record(z.string(), z.unknown()),
  options: z.array(z.enum(["color", "switch", "size"])).min(1),
  badges: z.array(badgeSchema).max(2).default([]),
  fit: fitSchema,
  in_box: z.array(z.string().min(1).max(120)).max(20).default([]),
  gpsr: gpsrSchema,
});

export const variantCreateSchema = z.strictObject({
  sku: skuSchema,
  color: colorIdSchema,
  switch: switchIdSchema.nullable().optional(),
  size: padSizeKeySchema.nullable().optional(),
  price_gr: groszePositive,
  regular_price_gr: groszePositive.nullable().optional(),
  stock: z.int().min(0),
  images_key: z.string().min(1),
});
export const variantPatchSchema = nonEmptyPatch(
  z.strictObject({
    color: colorIdSchema.optional(),
    switch: switchIdSchema.nullable().optional(),
    size: padSizeKeySchema.nullable().optional(),
    images_key: z.string().min(1).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  }),
);

/** PUT /variants/{sku}/price: dopisuje wpis do price_history; lowest_30d liczy serwer, brak pola recznego (ADR-0005). */
export const setPriceRequestSchema = z.strictObject({
  price_gr: groszePositive,
  regular_price_gr: groszePositive.nullable().optional(),
  reason: z.string().max(200).optional(),
});
export const priceHistoryEntrySchema = z.object({
  price_gr: groszePositive,
  valid_from: dateTimeSchema,
  valid_to: dateTimeSchema.nullable(),
  changed_by: z.string().nullable(),
  reason: z.string().nullable(),
});
export const priceHistoryResponseSchema = z.object({
  sku: skuSchema,
  entries: z.array(priceHistoryEntrySchema),
  lowest_30d_gr: groszeNonNegative.nullable(),
  window: z.object({ from: dateTimeSchema, to: dateTimeSchema }).nullable(),
});

export const setStockRequestSchema = z.strictObject({
  stock: z.int().min(0),
  reason: z.string().trim().min(1).max(200),
});
export const stockMovementSchema = z.object({
  id: z.string(),
  delta: z.int(),
  stock_after: z.int().min(0),
  kind: z.enum(["seed", "adjustment", "sale", "sale_reverted"]),
  order_number: z.string().nullable(),
  reason: z.string().nullable(),
  actor: z.string().nullable(),
  at: dateTimeSchema,
});
export const stockMovementsResponseSchema = z.object({
  sku: skuSchema,
  items: z.array(stockMovementSchema),
});

export const adminPresetSchema = presetSchema.extend({
  version: versionSchema,
  updated_at: dateTimeSchema,
});
export const adminPresetsResponseSchema = z.object({ items: z.array(adminPresetSchema) });
export const presetUpdateSchema = nonEmptyPatch(
  z.strictObject({
    name: z.string().trim().min(2).max(60).optional(),
    profile: profileIdSchema.optional(),
    note: z.string().trim().max(200).optional(),
    skus: z.array(skuSchema).length(3).optional(),
  }),
);

export const categoryPatchSchema = nonEmptyPatch(
  z.strictObject({
    name: z.string().trim().min(2).max(40).optional(),
    h1: z.string().trim().min(2).max(80).optional(),
    intro: z.string().trim().min(5).max(400).optional(),
    position: z.int().min(1).max(99).optional(),
  }),
);
export const adminCategorySchema = categorySchema.extend({ version: versionSchema });

export const dictionaryPatchSchema = nonEmptyPatch(
  z.strictObject({
    label: z.string().trim().min(1).max(60).optional(),
    name: z.string().trim().min(1).max(60).optional(),
    summary: z.string().trim().max(200).optional(),
    swatch: z.string().trim().min(4).max(9).optional(),
  }),
);

/** PATCH /v1/admin/rules (owner): profile i parametry; nieznana regula = 422. */
export const rulesPatchSchema = nonEmptyPatch(
  z.strictObject({
    profiles: z
      .record(
        profileIdSchema,
        z.strictObject({
          label: z.string().min(1).max(80),
          mouse_zone_mm: z.int().min(100).max(1000),
          default_switch: switchIdSchema,
        }),
      )
      .optional(),
    gap_keyboard_mouse_mm: z.int().min(0).max(200).optional(),
    edge_margin_mm: z.int().min(0).max(200).optional(),
  }),
);
