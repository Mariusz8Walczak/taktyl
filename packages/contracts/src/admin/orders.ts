// B-020...B-022 (docs/16 §3.3, §5): zamowienia w backpanelu. Dane osobowe maskowane dla viewer po stronie API.
import { z } from "zod";
import { orderStatusSchema, paymentTypeSchema, shippingMethodIdSchema } from "../shared/enums";
import { pageOf, pageQuerySchema } from "../shared/pagination";
import { dateSchema, dateTimeSchema, groszeNonNegative, orderNumberSchema } from "../shared/primitives";
import { orderDetailSchema, orderStatusEntrySchema } from "../public/orders";

export const adminOrderListQuerySchema = pageQuerySchema.extend({
  status: orderStatusSchema.optional(), from: dateSchema.optional(), to: dateSchema.optional(),
  number: z.string().max(20).optional(), payment_type: paymentTypeSchema.optional(),
  /** B-201: filtr metody dostawy */
  shipping_method: shippingMethodIdSchema.optional(),
  sort: z.string().regex(/^-?[a-z_]+$/).default("-created_at"),
});
export const adminOrderRowSchema = z.object({
  number: orderNumberSchema, status: orderStatusSchema, created_at: dateTimeSchema, total_gr: groszeNonNegative,
  payment_type: paymentTypeSchema, shipping_method: shippingMethodIdSchema,
  /** zawsze zamaskowany na liscie (a***@taktyl.example); pelne dane dopiero w szczegolach (owner, editor) */
  contact_email: z.string(),
  /** B-200: liczba pozycji (wierszy order_items) */
  items_count: z.int().min(0),
});
export const adminOrderListSchema = pageOf(adminOrderRowSchema);

/** Docelowe statusy przejsc recznych editora (docs/16 §5). `paid`, `payment_failed` ustawia tylko system. */
export const orderTransitionTargetSchema = z.enum(["processing", "shipped", "delivered", "cancelled"]);

/** B-204: notatka wewnetrzna (autor = e-mail konta backpanelu, dla viewer zamaskowany). */
export const orderNoteSchema = z.object({ id: z.string().regex(/^\d+$/), author: z.string().nullable(), body: z.string(), at: dateTimeSchema });

export const adminOrderDetailSchema = orderDetailSchema.extend({
  contact: z.object({ email: z.string(), phone: z.string() }),
  shipping_address: z.record(z.string(), z.string()).nullable(),
  invoice: z.record(z.string(), z.string()).nullable(),
  /** ostatnia notatka (skrot dla list); komplet w `notes` */
  internal_note: z.string().nullable(),
  notes: z.array(orderNoteSchema),
  /** B-203: przejscia dostepne dla biezacego uzytkownika ze statusu zamowienia (pusta lista dla viewer i statusow koncowych) */
  allowed_transitions: z.array(orderTransitionTargetSchema),
  history: z.array(orderStatusEntrySchema),
});

/** Przejscia reczne editora (docs/16 §5). `paid`, `payment_failed` ustawia tylko system. */
export const orderTransitionRequestSchema = z
  .strictObject({
    to: orderTransitionTargetSchema, note: z.string().trim().max(500).optional(),
  })
  // B-205: anulowanie wymaga powodu (min. 5 znakow), docs/15 §8.2 "Podaj powod anulowania."
  .refine((v) => v.to !== "cancelled" || (v.note?.length ?? 0) >= 5, { path: ["note"], message: "Podaj powod anulowania (min. 5 znakow)." });
export const orderNoteRequestSchema = z.strictObject({ note: z.string().trim().min(1).max(1000) });
