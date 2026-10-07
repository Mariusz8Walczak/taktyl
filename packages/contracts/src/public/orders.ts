// F-170...F-180, F-201, F-202, F-221, F-223 (docs/16 §6.2, §6.3, ADR-0007).
// Zero pol na dane kart, kody BLIK i hasla (regula 10): strictObject odrzuca nieznane pola.
import { z } from "zod";
import { orderStatusSchema, paymentTypeSchema, shippingMethodIdSchema } from "../shared/enums";
import {
  couponCodeSchema, currencySchema, dateSchema, dateTimeSchema, emailSchema, groszeNonNegative, nipSchema,
  orderNumberSchema, phoneSchema, postcodeSchema, skuSchema,
} from "../shared/primitives";
import { cartItemsSchema } from "./cart";

const personName = z.string().trim().min(2).max(100);

/** Pola zalezne od dostawy (docs/16 §6.2, shop.json shipping_methods[].fields). */
export const shippingInputSchema = z.discriminatedUnion("method", [
  z.strictObject({ method: z.literal("automat"), point: z.string().regex(/^[A-Z]{3}-\d{3}$/) }),
  z.strictObject({
    method: z.literal("kurier"), name: personName, street: z.string().trim().min(2).max(120),
    postcode: postcodeSchema, city: z.string().trim().min(2).max(80),
  }),
  z.strictObject({ method: z.literal("odbior"), name: personName }),
]);
export type ShippingInput = z.infer<typeof shippingInputSchema>;

export const invoiceInputSchema = z.strictObject({
  nip: nipSchema, name: z.string().trim().min(2).max(160), address: z.string().trim().min(5).max(240),
});

export const orderRequestSchema = z.strictObject({
  items: cartItemsSchema,
  coupon: couponCodeSchema.nullable().optional(),
  contact: z.strictObject({ email: emailSchema, phone: phoneSchema }),
  shipping: shippingInputSchema,
  invoice: invoiceInputSchema.nullable().optional(),
  payment_type: paymentTypeSchema,
  consents: z.strictObject({ terms: z.literal(true), newsletter: z.boolean().default(false) }),
  /** Suma pokazana uzytkownikowi; niezgodnosc = 409 price_changed. Serwer i tak liczy sam (ADR-0007). */
  expected_total_gr: groszeNonNegative,
});
export type OrderRequest = z.infer<typeof orderRequestSchema>;

export const etaSchema = z.object({ dispatch_date: dateSchema, delivery_date: dateSchema });

export const orderCreatedSchema = z.object({
  number: orderNumberSchema, status: z.literal("pending_payment"), order_token: z.string().min(16),
  currency: currencySchema, items_total_gr: groszeNonNegative, shipping_gr: groszeNonNegative, total_gr: groszeNonNegative,
  payment: z.object({ type: paymentTypeSchema, simulate_url: z.string().startsWith("/") }), eta: etaSchema,
});
export type OrderCreated = z.infer<typeof orderCreatedSchema>;

export const orderItemSchema = z.object({
  group_id: z.string().nullable(), sku: skuSchema, name: z.string(), variant_label: z.string(),
  qty: z.int().min(1).max(10), unit_price_gr: groszeNonNegative, set_discount_gr: groszeNonNegative,
  coupon_discount_gr: groszeNonNegative,
});
export const orderStatusEntrySchema = z.object({
  from: orderStatusSchema.nullable(), to: orderStatusSchema, actor: z.string(), note: z.string().nullable(), at: dateTimeSchema,
});

/** GET /v1/orders/{number} (wlasciciel tokenu). */
export const orderDetailSchema = z.object({
  number: orderNumberSchema, status: orderStatusSchema, currency: currencySchema, created_at: dateTimeSchema,
  items: z.array(orderItemSchema).min(1),
  items_gr: groszeNonNegative, set_discount_gr: groszeNonNegative, coupon_discount_gr: groszeNonNegative,
  shipping_gr: groszeNonNegative, total_gr: groszeNonNegative, coupon_code: couponCodeSchema.nullable(),
  shipping_method: shippingMethodIdSchema,
  payment: z.object({ type: paymentTypeSchema, status: z.enum(["created", "paid", "failed"]), attempts: z.int().min(0) }),
  eta: etaSchema.nullable(),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;
export const orderListSchema = z.object({ items: z.array(orderDetailSchema) });

export const paymentSimulateRequestSchema = z.strictObject({ outcome: z.enum(["paid", "failed"]) });
export const paymentSimulateResponseSchema = z.object({
  status: z.enum(["paid", "payment_failed"]), transaction_id: orderNumberSchema,
});

/** Naglowek X-Order-Token (docs/16 §1.1); lista zamowien przyjmuje kilka tokenow po przecinku. */
export const orderTokenHeaderSchema = z.string().min(16).max(2000);

export const contactFormSchema = z.strictObject({
  email: emailSchema, subject: z.string().trim().min(2).max(120), message: z.string().trim().min(5).max(2000),
});
export const newsletterFormSchema = z.strictObject({ email: emailSchema });

/** Komunikat formularzy w demo (F-221, F-223): nic nie jest wysylane, zgloszenie trafia tylko do panelu. */
export const FORM_DEMO_NOTICE = "W sklepie demonstracyjnym nie wysyłamy e-maili." as const;
export const formAcceptedSchema = z.object({
  status: z.literal("accepted"), demo: z.literal(true), message: z.string(),
});
