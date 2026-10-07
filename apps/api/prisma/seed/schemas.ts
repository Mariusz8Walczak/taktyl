// B-102 (docs/17 par. 7): schematy surowego JSON-a z data/*.json, assets/manifest.json i content/pages.
// Kontrakty API (@taktyl/contracts) opisuja DTO, nie surowe pliki, wiec seed ma wlasne, scisle schematy;
// jedynie wzorzec SKU jest wspolny. Nieznane pole = blad z nazwa pliku i sciezka (loadSeedData).
import { SKU_PATTERN } from "@taktyl/contracts";
import { z } from "zod";

export const categorySchema = z.strictObject({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  h1: z.string().min(1),
  order: z.int().min(1),
  intro: z.string().min(1),
});

export const colorsSchema = z.record(
  z.string().min(1),
  z.strictObject({
    code: z.string().regex(/^[A-Z]{3}$/),
    label: z.string().min(1),
    harmony: z.string().min(1),
    swatch: z.string().min(1),
  }),
);

export const switchSchema = z.strictObject({
  id: z.string().min(1),
  code: z.string().regex(/^[A-Z]{3}$/),
  name: z.string().min(1),
  type: z.string().min(1),
  type_label: z.string().min(1),
  force_g: z.int().min(1),
  sound: z.string().min(1),
  summary: z.string().min(1),
});

const zl = z.number().finite().min(0);

export const rawVariantSchema = z.strictObject({
  sku: z.string().regex(SKU_PATTERN),
  color: z.string().min(1),
  switch: z.string().min(1).optional(),
  size: z.enum(["m", "l", "xl", "xxl"]).optional(),
  price: zl,
  regular_price: zl.nullable(),
  lowest_30d: zl.nullable(),
  stock: z.int().min(0),
  images: z.string().min(1),
});

export const productSchema = z.strictObject({
  id: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().min(1),
  name: z.string().min(1),
  brand: z.literal("Taktyl"),
  short: z.string().min(1),
  description: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  options: z.array(z.enum(["color", "switch", "size"])).min(1),
  default_variant: z.string().min(1),
  variants: z.array(rawVariantSchema).min(1),
  images: z.record(
    z.string(),
    z.strictObject({
      packshots: z.array(z.string()),
      topdown: z.string().optional(),
      texture: z.string().optional(),
    }),
  ),
  badges: z.array(z.enum(["nowosc", "bestseller"])),
  fit: z.strictObject({
    fps: z.int().min(0).max(3),
    gry: z.int().min(0).max(3),
    programowanie: z.int().min(0).max(3),
    biuro: z.int().min(0).max(3),
    cisza: z.int().min(0).max(3),
  }),
  in_box: z.array(z.string()),
  gpsr: z.strictObject({
    manufacturer: z.string(),
    address: z.string(),
    contact: z.string(),
    warnings: z.string(),
  }),
});

const facetSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["multi", "range", "bool", "buckets", "number-match"]),
  attr: z.string().min(1),
  values: z.array(z.unknown()).optional(),
  unit: z.string().optional(),
  hint: z.string().optional(),
});
export const facetsSchema = z.record(z.string(), z.array(facetSchema));

export const rulesSchema = z.strictObject({
  units: z.string().min(1),
  profiles: z.record(
    z.string(),
    z.strictObject({
      label: z.string(),
      mouse_zone_mm: z.int().min(1),
      default_switch: z.string(),
    }),
  ),
  no_profile: z.strictObject({ mouse_zone_mm: z.int().min(1), message: z.string() }),
  gap_keyboard_mouse_mm: z.int().min(0),
  edge_margin_mm: z.int().min(0),
  checks: z.array(z.record(z.string(), z.unknown())).min(1),
  suggestion_order: z.record(z.string(), z.array(z.string())),
  never_block: z.boolean(),
});

export const presetSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  profile: z.string().min(1),
  skus: z.array(z.string().regex(SKU_PATTERN)).length(3),
  note: z.string().min(1),
  sum: zl,
  set_discount: zl,
  total: zl,
});

export const shopSchema = z.strictObject({
  currency: z.literal("PLN"),
  locale: z.string().min(1),
  timezone: z.string().min(1),
  free_shipping_threshold: zl,
  set_discount: z.strictObject({
    percent: z.int().min(0).max(100),
    requires_categories: z.array(z.string()).min(1),
    base: z.string(),
    combines_with_codes: z.boolean(),
    rounding: z.string(),
  }),
  shipping_methods: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        label: z.string().min(1),
        price: zl,
        eta_business_days: z.int().min(0),
        fields: z.array(z.string()),
        address: z.string().optional(),
      }),
    )
    .min(1),
  dispatch: z.strictObject({ cutoff_hour: z.int().min(0).max(23), rule: z.string() }),
  payment_methods: z
    .array(z.strictObject({ id: z.string().min(1), label: z.string().min(1) }))
    .min(1),
  payment_simulation: z.boolean(),
  codes: z.array(
    z.strictObject({
      code: z.string().regex(/^[A-Z0-9_-]+$/),
      type: z.enum(["percent", "free_shipping"]),
      value: z.int().min(1).max(100).optional(),
      scope: z.string(),
      label: z.string(),
    }),
  ),
  pickup_points: z.array(z.strictObject({ id: z.string(), city: z.string(), label: z.string() })),
  returns_days: z.int().min(0),
  statutory_withdrawal_days: z.int().min(0),
  demo: z.strictObject({
    label: z.string().min(1),
    email_domain: z.literal("taktyl.example"),
    phone: z.string().min(1),
  }),
});

export const descriptionsSchema = z.record(z.string(), z.string().min(1));

export const manifestEntrySchema = z.object({
  key: z.string().min(1),
  product_id: z.string().min(1),
  color: z.string().min(1),
  kind: z.enum(["packshot", "topdown", "texture"]),
  shot: z.string().optional(),
  description: z.string().nullish(),
  priority: z.enum(["P0", "P1"]),
  status: z.enum(["brak", "gotowe"]),
  files: z.array(z.string()),
  dims_mm: z.unknown().optional(),
  pixels: z.unknown().optional(),
});
export const manifestSchema = z.array(manifestEntrySchema);

export const pageFrontmatterSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  updated: z.iso.date(),
  demo: z.enum(["true", "false"]).transform((v) => v === "true"),
});

// F-220 (D-011): poradnik to strona typu `guide`; `profile` trafia do `guide_profile`, `reading_minutes` jest kontrolna
// (baza go nie przechowuje, sklep liczy czas czytania z dlugosci), `demo` musi byc true.
export const guideFrontmatterSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(2),
  updated: z.iso.date(),
  lead: z.string().min(20).max(220),
  profile: z.string().min(1),
  reading_minutes: z
    .string()
    .regex(/^\d{1,2}$/)
    .transform(Number)
    .pipe(z.int().min(1).max(30)),
  demo: z.literal("true").transform(() => true as const),
});

// F-076, docs/04 par. 8: opinie demo. Autor to imie i inicjal; oceny 3-5; `demo` zawsze true (CHECK w bazie);
// `variant` to etykieta wariantu ("Grafit · Prog"), w bazie `variant_label`.
export const REVIEW_AUTHOR = /^\p{Lu}\p{Ll}+ \p{Lu}\.$/u;
export const reviewSchema = z.strictObject({
  author: z.string().regex(REVIEW_AUTHOR),
  date: z.iso.date(),
  rating: z.int().min(3).max(5),
  variant: z.string().min(1),
  text: z.string().min(1).max(600),
  demo: z.literal(true),
});
export const reviewsFileSchema = z.record(z.string().min(1), z.array(reviewSchema).min(3).max(6));

// F-221: FAQ (content/faq.json). `key` daje stabilny identyfikator wiersza `faq_items.id` (`faq-<key>`).
export const faqFileSchema = z
  .array(
    z.strictObject({
      key: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(30),
      question: z.string().trim().min(5).max(200),
      answer_md: z.string().trim().min(5).max(3000),
    }),
  )
  .min(1)
  .max(50);
