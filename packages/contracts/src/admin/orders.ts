// B-020...B-022 (docs/16 §3.3, §5): zamowienia w backpanelu. Dane osobowe maskowane dla viewer po stronie API.
import { z } from "zod";
import { orderStatusSchema, paymentTypeSchema, shippingMethodIdSchema } from "../shared/enums";
import { pageOf, pageQuerySchema } from "../shared/pagination";
import { dateSchema, dateTimeSchema, groszeNonNegative, orderNumberSchema } from "../shared/primitives";
import { orderDetailSchema, orderStatusEntrySchema } from "../public/orders";

export const adminOrderListQuerySchema = pageQuerySchema.extend({
  status: orderStatusSchema.optional(), from: dateSchema.optional(), to: dateSchema.optional(),
  number: z.string().max(20).optional(), payment_type: paymentTypeSchema.optional(),
  sort: z.string().regex(/^-?[a-z_]+$/).default("-created_at"),
});
export const adminOrderRowSchema = z.object({
  number: orderNumberSchema, status: orderStatusSchema, created_at: dateTimeSchema, total_gr: groszeNonNegative,
  payment_type: paymentTypeSchema, shipping_method: shippingMethodIdSchema,
  contact_email: z.string(), // zamaskowany dla viewer: a***@taktyl.example
});
export const adminOrderListSchema = pageOf(adminOrderRowSchema);

export const adminOrderDetailSchema = orderDetailSchema.extend({
  contact: z.object({ email: z.string(), phone: z.string() }),
  shipping_address: z.record(z.string(), z.string()).nullable(),
  invoice: z.record(z.string(), z.string()).nullable(),
  internal_note: z.string().nullable(),
  history: z.array(orderStatusEntrySchema),
});

/** Przejscia reczne editora (docs/16 §5). `paid`, `payment_failed` ustawia tylko system. */
export const orderTransitionRequestSchema = z.strictObject({
  to: z.enum(["processing", "shipped", "delivered", "cancelled"]), note: z.string().trim().max(500).optional(),
});
export const orderNoteRequestSchema = z.strictObject({ note: z.string().trim().min(1).max(1000) });
