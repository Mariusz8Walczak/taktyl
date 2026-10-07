// F-150...F-157, F-024 (docs/16 §6.1, ADR-0007): wycena koszyka. Zadanie niesie TYLKO SKU, ilosci, sety i kod: ceny nigdy z klienta.
import { z } from "zod";
import { profileIdSchema, shippingMethodIdSchema } from "../shared/enums";
import { couponCodeSchema, currencySchema, groszeNonNegative, qtySchema, skuSchema } from "../shared/primitives";

export const cartItemLineSchema = z.strictObject({ type: z.literal("item"), sku: skuSchema, qty: qtySchema });
/** Set = dokladnie 3 SKU z trzech kategorii (docs/03 §7); `id` to identyfikator grupy z koszyka klienta. */
export const cartSetLineSchema = z.strictObject({
  type: z.literal("set"), id: z.string().min(1).max(64), qty: qtySchema,
  profile: profileIdSchema.nullable().optional(), skus: z.array(skuSchema).length(3),
});
export const cartLineSchema = z.discriminatedUnion("type", [cartItemLineSchema, cartSetLineSchema]);
export type CartLine = z.infer<typeof cartLineSchema>;

export const cartItemsSchema = z.array(cartLineSchema).min(1).max(50);

export const quoteRequestSchema = z.strictObject({
  items: cartItemsSchema,
  coupon: couponCodeSchema.nullable().optional(),
  shipping_method: shippingMethodIdSchema.nullable().optional(),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

const quoteSetItem = z.object({
  sku: skuSchema, name: z.string(), price_gr: groszeNonNegative, set_discount_gr: groszeNonNegative,
  stock: z.int().min(0), available: z.boolean(),
});
export const quoteSetLineSchema = z.object({
  type: z.literal("set"), id: z.string(), qty: qtySchema, items: z.array(quoteSetItem).length(3),
  subtotal_gr: groszeNonNegative, set_discount_gr: groszeNonNegative, total_gr: groszeNonNegative,
});
export const quoteItemLineSchema = z.object({
  type: z.literal("item"), sku: skuSchema, name: z.string(), qty: qtySchema, price_gr: groszeNonNegative,
  coupon_discount_gr: groszeNonNegative, stock: z.int().min(0), available: z.boolean(),
});

export const quoteProblemSchema = z.object({
  sku: z.string(), code: z.enum(["out_of_stock", "price_changed", "unknown_sku"]),
  available_qty: z.int().min(0).optional(),
});

export const quoteResponseSchema = z.object({
  currency: currencySchema,
  lines: z.array(z.discriminatedUnion("type", [quoteSetLineSchema, quoteItemLineSchema])),
  summary: z.object({
    products_gr: groszeNonNegative, set_discount_gr: groszeNonNegative, coupon_discount_gr: groszeNonNegative,
    shipping_from_gr: groszeNonNegative, total_gr: groszeNonNegative, free_shipping_remaining_gr: groszeNonNegative,
  }),
  coupon: z.object({ code: couponCodeSchema, applied: z.boolean(), message_code: z.string().regex(/^[a-z_]+$/) }).nullable(),
  problems: z.array(quoteProblemSchema),
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
