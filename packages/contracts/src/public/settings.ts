// F-001, F-009, F-073, F-153, F-065 (docs/16 §2): ustawienia publiczne sklepu. Kody: tylko etykiety, bez logiki.
import { z } from "zod";
import { categoryIdSchema, paymentTypeSchema, shippingMethodIdSchema } from "../shared/enums";
import { couponCodeSchema, currencySchema, dateSchema, dateTimeSchema, groszeNonNegative } from "../shared/primitives";

export const shippingFieldSchema = z.enum(["email", "phone", "name", "street", "postcode", "city", "point"]);
export const shippingMethodSchema = z.object({
  id: shippingMethodIdSchema, label: z.string(), price_gr: groszeNonNegative,
  eta_business_days: z.int().min(0).max(30), fields: z.array(shippingFieldSchema), address: z.string().nullable(),
});
export const paymentMethodSchema = z.object({ id: paymentTypeSchema, label: z.string() });
export const pickupPointSchema = z.object({ id: z.string().regex(/^[A-Z]{3}-\d{3}$/), city: z.string(), label: z.string() });

export const setDiscountSchema = z.object({
  percent: z.int().min(0).max(50),
  categories: z.array(categoryIdSchema).length(3),
});

export const publicShopSettingsSchema = z.object({
  currency: currencySchema, locale: z.literal("pl-PL"), timezone: z.literal("Europe/Warsaw"),
  free_shipping_threshold_gr: groszeNonNegative, set_discount: setDiscountSchema,
  dispatch_cutoff_hour: z.int().min(0).max(23),
  shipping_methods: z.array(shippingMethodSchema), payment_methods: z.array(paymentMethodSchema),
  discount_codes: z.array(z.object({ code: couponCodeSchema, label: z.string() })),
  pickup_points: z.array(pickupPointSchema),
  returns_days: z.int().min(0), statutory_withdrawal_days: z.int().min(0),
  payment_simulation: z.literal(true),
  demo: z.object({ label: z.string(), email_domain: z.literal("taktyl.example"), phone: z.string() }),
  company: z.record(z.string(), z.string()),
});
export type PublicShopSettings = z.infer<typeof publicShopSettingsSchema>;

export const shippingEstimateQuerySchema = z.object({ method: shippingMethodIdSchema });
export const shippingEstimateResponseSchema = z.object({
  method: shippingMethodIdSchema, dispatch_date: dateSchema, delivery_date: dateSchema,
  dispatches_today: z.boolean(), computed_at: dateTimeSchema,
});
export const pickupPointsQuerySchema = z.object({ city: z.string().min(1).max(60).optional() });
export const pickupPointsResponseSchema = z.object({ items: z.array(pickupPointSchema) });
