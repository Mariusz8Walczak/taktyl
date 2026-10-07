// F-020...F-026, F-060...F-072, F-111 (docs/16 §2, docs/04): katalog publiczny.
import { z } from "zod";
import {
  badgeSchema,
  categoryIdSchema,
  colorIdSchema,
  padSizeKeySchema,
  profileIdSchema,
  sortKeySchema,
  switchIdSchema,
} from "../shared/enums";
import { cursorOf } from "../shared/pagination";
import { groszeNonNegative, productIdSchema, skuSchema, slugSchema } from "../shared/primitives";

const dims = z.object({ w: z.int().positive(), d: z.int().positive(), h: z.int().positive() });
const connectivity = z.enum(["usb-c", "2.4ghz", "bt", "przewod"]);

// Atrybuty per kategoria (docs/04 §4, docs/17 §1: JSONB walidowany Zod per kategoria).
export const keyboardAttributesSchema = z.object({
  size: z.string(),
  size_label: z.string(),
  keys: z.int().positive(),
  layout: z.string(),
  connectivity: z.array(connectivity).min(1),
  case: z.string(),
  mount: z.string(),
  hotswap: z.boolean(),
  keycaps: z.string(),
  backlight: z.string(),
  battery: z.string().nullable(),
  knob: z.boolean(),
  weight_g: z.int().positive(),
  dims_mm: dims,
});
export const mouseAttributesSchema = z.object({
  shape: z.string(),
  hand: z.enum(["prawa", "obureczna"]),
  hand_note: z.string().nullable().optional(),
  size: z.enum(["S", "M", "L"]),
  hand_cm: z.tuple([z.number().positive(), z.number().positive()]),
  grips: z.array(z.enum(["palm", "claw", "fingertip"])).min(1),
  weight_g: z.int().positive(),
  dims_mm: dims,
  connectivity: z.array(connectivity).min(1),
  dpi_max: z.int().positive(),
  polling_hz: z.int().positive(),
  battery: z.string().nullable(),
  sensor: z.string(),
});
export const padSizeSchema = z.object({
  label: z.string(),
  w: z.int().positive(),
  d: z.int().positive(),
  type: z.enum(["mysz", "biurko"]),
});
export const padAttributesSchema = z.object({
  surface: z.string(),
  material: z.string(),
  thickness_mm: z.int().positive(),
  edge: z.string(),
  sizes: z.partialRecord(padSizeKeySchema, padSizeSchema),
});
export const attributesSchemaByCategory = {
  klawiatury: keyboardAttributesSchema,
  myszki: mouseAttributesSchema,
  podkladki: padAttributesSchema,
} as const;

export const fitSchema = z.object({
  fps: z.int().min(0).max(3),
  gry: z.int().min(0).max(3),
  programowanie: z.int().min(0).max(3),
  biuro: z.int().min(0).max(3),
  cisza: z.int().min(0).max(3),
});
export const gpsrSchema = z.object({
  manufacturer: z.string(),
  address: z.string(),
  contact: z.string(),
  warnings: z.string(),
});

export const categorySchema = z.object({
  id: categoryIdSchema,
  slug: slugSchema,
  name: z.string(),
  h1: z.string(),
  intro: z.string(),
  position: z.int(),
  model_count: z.int().min(0),
  from_price_gr: groszeNonNegative.nullable(),
});
export type Category = z.infer<typeof categorySchema>;
export const categoriesResponseSchema = z.object({ items: z.array(categorySchema) });

export const imageRefSchema = z.object({
  key: z.string(),
  kind: z.enum(["packshot", "topdown", "texture"]),
  shot: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(["brak", "gotowe"]),
  files: z.array(z.string()),
});

/** Wariant w odpowiedzi publicznej. `regular_price` nie wystepuje nigdy (docs/04 §5.2); `lowest_30d_gr` liczy serwer (ADR-0005). */
export const variantSchema = z.object({
  sku: skuSchema,
  color: colorIdSchema,
  switch: switchIdSchema.nullable(),
  size: padSizeKeySchema.nullable(),
  price_gr: groszeNonNegative,
  lowest_30d_gr: groszeNonNegative.nullable(),
  stock: z.int().min(0),
  images_key: z.string(),
  status: z.enum(["active", "disabled"]),
});
export type Variant = z.infer<typeof variantSchema>;

const productBase = {
  id: productIdSchema,
  slug: slugSchema,
  name: z.string(),
  brand: z.literal("Taktyl"),
  short: z.string(),
  description: z.string().nullable(),
  options: z.array(z.enum(["color", "switch", "size"])),
  default_variant_sku: skuSchema,
  badges: z.array(badgeSchema),
  fit: fitSchema,
  in_box: z.array(z.string()),
  gpsr: gpsrSchema,
  variants: z.array(variantSchema).min(1),
  images: z.array(imageRefSchema),
};
export const productSchema = z.discriminatedUnion("category", [
  z.object({
    ...productBase,
    category: z.literal("klawiatury"),
    attributes: keyboardAttributesSchema,
  }),
  z.object({ ...productBase, category: z.literal("myszki"), attributes: mouseAttributesSchema }),
  z.object({ ...productBase, category: z.literal("podkladki"), attributes: padAttributesSchema }),
]);
export type Product = z.infer<typeof productSchema>;
export const productQuerySchema = z.object({ sku: skuSchema.optional() });

/** Karta na listingu (F-020): "od X zl" z najtanszego dostepnego wariantu (docs/04 §5.1). */
export const productCardSchema = z.object({
  id: productIdSchema,
  slug: slugSchema,
  category: categoryIdSchema,
  name: z.string(),
  short: z.string(),
  badges: z.array(badgeSchema),
  from_price_gr: groszeNonNegative,
  lowest_30d_gr: groszeNonNegative.nullable(),
  in_stock: z.boolean(),
  default_variant_sku: skuSchema,
  matched_variant_sku: skuSchema.nullable(),
  color_count: z.int().min(1),
});
export type ProductCard = z.infer<typeof productCardSchema>;

// Filtry w adresie (docs/04 §6). Wartosci po przecinku; cena w GROSZACH (docs/16 §1).
const csv = z
  .string()
  .regex(/^[a-z0-9.]+(?:-[a-z0-9.]+)*(?:,[a-z0-9.]+(?:-[a-z0-9.]+)*)*$/)
  .transform((v) => v.split(","));
export const filtersSchema = z.object({
  rozmiar: csv.optional(),
  przelacznik: csv.optional(),
  lacznosc: csv.optional(),
  obudowa: csv.optional(),
  kolor: csv.optional(),
  waga: csv.optional(),
  ksztalt: csv.optional(),
  reka: csv.optional(),
  typ: csv.optional(),
  powierzchnia: csv.optional(),
  hotswap: z.literal("1").optional(),
  dostepnosc: z.literal("1").optional(),
  cena: z
    .string()
    .regex(/^\d+-\d+$/)
    .optional(),
  dlon: z
    .string()
    .regex(/^\d{2}(?:\.\d)?$/)
    .optional(),
});
export type Filters = z.infer<typeof filtersSchema>;

export const listingQuerySchema = filtersSchema.extend({
  category: categoryIdSchema,
  sort: sortKeySchema.default("polecane"),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  cursor: z.string().min(1).max(512).optional(),
});
export type ListingQuery = z.infer<typeof listingQuerySchema>;
export const listingResponseSchema = cursorOf(productCardSchema);
export type ListingResponse = z.infer<typeof listingResponseSchema>;

// Facety z licznikami (F-021, F-029).
const facetValue = z.object({
  v: z.string(),
  label: z.string(),
  count: z.int().min(0),
  disabled: z.boolean(),
});
const facetHead = { id: z.string(), label: z.string() };
export const facetSchema = z.discriminatedUnion("type", [
  z.object({ ...facetHead, type: z.literal("multi"), values: z.array(facetValue) }),
  z.object({ ...facetHead, type: z.literal("buckets"), values: z.array(facetValue) }),
  z.object({
    ...facetHead,
    type: z.literal("range"),
    min_gr: groszeNonNegative,
    max_gr: groszeNonNegative,
  }),
  z.object({ ...facetHead, type: z.literal("bool"), count: z.int().min(0), disabled: z.boolean() }),
  z.object({
    ...facetHead,
    type: z.literal("number-match"),
    min_cm: z.number(),
    max_cm: z.number(),
  }),
]);
export const facetsQuerySchema = filtersSchema.extend({ category: categoryIdSchema });
export const facetsResponseSchema = z.object({
  category: categoryIdSchema,
  total: z.int().min(0),
  facets: z.array(facetSchema),
});
export type FacetsResponse = z.infer<typeof facetsResponseSchema>;

// Wyszukiwanie (F-005...F-007); normalizacja q po stronie serwera (domain).
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
export const searchResponseSchema = z.object({
  products: z.array(productCardSchema),
  categories: z.array(z.object({ id: categoryIdSchema, slug: slugSchema, name: z.string() })),
  guides: z.array(z.object({ slug: slugSchema, title: z.string(), lead: z.string().nullable() })),
});

// Presety (F-111): cena liczona na biezaco, w groszach.
export const presetSchema = z.object({
  id: z.string(),
  name: z.string(),
  profile: profileIdSchema,
  note: z.string(),
  items: z
    .array(z.object({ sku: skuSchema, name: z.string(), price_gr: groszeNonNegative }))
    .length(3),
  sum_gr: groszeNonNegative,
  set_discount_gr: groszeNonNegative,
  total_gr: groszeNonNegative,
});
export type Preset = z.infer<typeof presetSchema>;
export const presetsResponseSchema = z.object({ items: z.array(presetSchema) });

// F-069: propozycja "Dokoncz set" - dwie pozostale kategorie dobrane wg fit, cena setu z rabatem (docs/16 par. 2).
export const completeSetQuerySchema = z.object({
  profile: profileIdSchema.optional(),
  sku: skuSchema.optional(),
});
export const completeSetResponseSchema = z.object({
  profile: profileIdSchema,
  items: z
    .array(z.object({ sku: skuSchema, name: z.string(), price_gr: groszeNonNegative }))
    .length(3),
  sum_gr: groszeNonNegative,
  set_discount_gr: groszeNonNegative,
  total_gr: groszeNonNegative,
});
export type CompleteSetResponse = z.infer<typeof completeSetResponseSchema>;

// Slowniki.
export const switchSchema = z.object({
  id: switchIdSchema,
  code: z.string().length(3),
  name: z.string(),
  type: z.string(),
  type_label: z.string(),
  force_g: z.int().positive(),
  sound: z.string(),
  summary: z.string(),
});
export const colorSchema = z.object({
  id: colorIdSchema,
  code: z.string().length(3),
  label: z.string(),
  harmony: z.string(),
  swatch: z.string(),
});
export const switchesResponseSchema = z.object({ items: z.array(switchSchema) });
export const colorsResponseSchema = z.object({ items: z.array(colorSchema) });

export const rulesSchema = z.object({
  units: z.literal("mm"),
  profiles: z.record(
    profileIdSchema,
    z.object({
      label: z.string(),
      mouse_zone_mm: z.int().positive(),
      default_switch: switchIdSchema,
    }),
  ),
  no_profile: z.object({ mouse_zone_mm: z.int().positive(), message: z.string() }),
  gap_keyboard_mouse_mm: z.int().min(0),
  edge_margin_mm: z.int().min(0),
  checks: z.array(z.looseObject({ id: z.string() })),
});
