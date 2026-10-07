// B-040, B-050, B-051 (docs/16 §3.5): ustawienia sklepu i media.
import { z } from "zod";
import { paymentTypeSchema, shippingMethodIdSchema } from "../shared/enums";
import {
  couponCodeSchema, dateTimeSchema, groszeNonNegative, versionSchema,
} from "../shared/primitives";
import { paymentMethodSchema, pickupPointSchema, publicShopSettingsSchema, setDiscountSchema, shippingFieldSchema } from "../public/settings";

export const discountCodeSchema = z.object({
  code: couponCodeSchema, type: z.enum(["percent", "free_shipping"]), value: z.int().min(1).max(90).nullable(),
  scope: z.string(), label: z.string(), active: z.boolean(),
  valid_from: dateTimeSchema.nullable(), valid_to: dateTimeSchema.nullable(),
});
export const adminShippingMethodSchema = z.object({
  id: shippingMethodIdSchema, label: z.string().min(1).max(60), price_gr: groszeNonNegative,
  eta_business_days: z.int().min(0).max(30), fields: z.array(shippingFieldSchema), address: z.string().nullable(),
  active: z.boolean(),
});

/** GET /v1/admin/settings: pelne ustawienia razem z kodami (logika) i wersja. */
export const adminSettingsSchema = publicShopSettingsSchema.extend({
  shipping_methods: z.array(adminShippingMethodSchema),
  payment_methods: z.array(paymentMethodSchema.extend({ active: z.boolean() })),
  discount_codes: z.array(discountCodeSchema),
  version: versionSchema, updated_at: dateTimeSchema,
});

/** PATCH /v1/admin/settings (owner, If-Match). Procent rabatu poza 0-50 = 422. */
export const settingsPatchSchema = z
  .strictObject({
    set_discount: setDiscountSchema.optional(),
    free_shipping_threshold_gr: groszeNonNegative.optional(),
    shipping_methods: z.array(adminShippingMethodSchema).optional(),
    payment_methods: z.array(z.strictObject({ id: paymentTypeSchema, label: z.string().min(1).max(60), active: z.boolean() })).optional(),
    discount_codes: z.array(discountCodeSchema).optional(),
    pickup_points: z.array(pickupPointSchema.extend({ active: z.boolean().default(true) })).optional(),
    demo: z.strictObject({ label: z.string().min(1).max(200) }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "pusty PATCH");

// Media (docs/09, assets/manifest.json). Wgranie pliku to multipart, wiec kontrakt dotyczy metadanych i odpowiedzi.
export const mediaEntrySchema = z.object({
  key: z.string(), kind: z.enum(["packshot", "topdown", "texture"]), shot: z.string().nullable(),
  priority: z.enum(["P0", "P1"]), status: z.enum(["brak", "gotowe"]), files: z.array(z.string()),
  pixels: z.object({ w: z.int().positive(), h: z.int().positive() }).nullable(),
  updated_at: dateTimeSchema.nullable(),
});
export const mediaListSchema = z.object({ items: z.array(mediaEntrySchema) });
export const mediaUploadResponseSchema = mediaEntrySchema.extend({ status: z.literal("gotowe") });
/** Dozwolone typy plikow przy wgrywaniu (415 poza nimi). */
export const MEDIA_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
