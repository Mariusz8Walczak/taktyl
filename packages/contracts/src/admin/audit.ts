// B-060, B-061, B-002 (docs/16 §3.5, docs/17 §3.6, docs/14 §6): audit_log, outbox, znaczniki rewalidacji, dashboard.
import { z } from "zod";
import { orderStatusSchema, roleSchema } from "../shared/enums";
import { pageOf, pageQuerySchema } from "../shared/pagination";
import { dateTimeSchema } from "../shared/primitives";

/** Znacznik revalidateTag z docs/14 §6. Nowa encja bez wpisu w tabeli znacznikow to blad (ADR-0003). */
export const REVALIDATE_TAG_PATTERN =
  /^(?:catalog|presets|rules|shop-settings|facets:\*|(?:product|category|facets|content|reviews):[a-z0-9]+(?:-[a-z0-9]+)*)$/;
export const revalidateTagSchema = z.string().regex(REVALIDATE_TAG_PATTERN, "nieznany znacznik cache");
export const revalidateTagsSchema = z.array(revalidateTagSchema).min(1).max(50);

/** POST /v1/admin/revalidate (owner) i webhook api -> web POST /api/revalidate. */
export const revalidateRequestSchema = z.strictObject({ tags: revalidateTagsSchema });
export const revalidateResponseSchema = z.object({ revalidated: z.array(revalidateTagSchema) });

export const outboxStatusSchema = z.enum(["pending", "sent", "failed"]);
export const outboxEntrySchema = z.object({
  /** BigInt w bazie, w JSON jako string cyfr */
  id: z.string().regex(/^\d+$/), created_at: dateTimeSchema, tags: revalidateTagsSchema,
  audit_id: z.string().regex(/^\d+$/).nullable(), status: outboxStatusSchema, attempts: z.int().min(0),
  next_attempt_at: dateTimeSchema, last_error: z.string().nullable(), sent_at: dateTimeSchema.nullable(),
});
export const outboxListSchema = pageOf(outboxEntrySchema);

export const auditEntrySchema = z.object({
  id: z.string().regex(/^\d+$/), at: dateTimeSchema, actor_id: z.string().nullable(), actor_role: roleSchema.or(z.literal("system")),
  /** np. product.update, variant.price.set, order.transition */
  action: z.string().regex(/^[a-z_]+(?:\.[a-z_]+)+$/), entity: z.string(), entity_id: z.string(),
  /** bez danych osobowych; pola kontaktowe maskowane (docs/17 §9) */
  before: z.unknown().nullable(), after: z.unknown().nullable(), request_id: z.string(),
});
export const auditListQuerySchema = pageQuerySchema.extend({
  entity: z.string().max(40).optional(), entity_id: z.string().max(80).optional(), actor_id: z.string().max(80).optional(),
  from: dateTimeSchema.optional(), to: dateTimeSchema.optional(),
});
export const auditListSchema = pageOf(auditEntrySchema);

/** B-600..B-607 (docs/15 par. 12): wylacznie liczby i listy z danych, bez wykresow. */
export const dashboardOrdersSchema = z.object({
  /** od polnocy w Europe/Warsaw */
  today: z.int().min(0),
  last_7_days: z.int().min(0),
  last_30_days: z.int().min(0),
  total: z.int().min(0),
  /** tylko statusy, ktore wystepuja (brak klucza = 0) */
  by_status: z.partialRecord(orderStatusSchema, z.int().min(0)),
});
export const dashboardLowStockItemSchema = z.object({
  sku: z.string(), product_id: z.string(), product_slug: z.string(), product_name: z.string(), stock: z.int().min(0),
});
export const dashboardOrderToHandleSchema = z.object({
  number: z.string(), paid_at: dateTimeSchema, total_gr: z.int().min(0),
});
export const dashboardRecentChangeSchema = z.object({
  id: z.string().regex(/^\d+$/), at: dateTimeSchema, actor_id: z.string().nullable(), actor_label: z.string(),
  action: z.string(), entity: z.string(), entity_id: z.string(),
});
export const dashboardSchema = z.object({
  generated_at: dateTimeSchema,
  orders: dashboardOrdersSchema,
  /** suma zamowien w statusie >= paid (paid, processing, shipped, delivered), grosze */
  revenue: z.object({ paid_7_days_gr: z.int().min(0), paid_30_days_gr: z.int().min(0) }),
  /** warianty aktywne ze stanem 0-3, rosnaco po stanie, potem SKU */
  low_stock: z.object({
    count: z.int().min(0), out_of_stock_count: z.int().min(0), items: z.array(dashboardLowStockItemSchema),
  }),
  /** B-604: oplacone dluzej niz 24 h */
  orders_to_handle: z.array(dashboardOrderToHandleSchema),
  images_p0: z.object({ ready: z.int().min(0), total: z.int().min(0) }),
  recent_changes: z.array(dashboardRecentChangeSchema).max(10),
  /** B-606 */
  connection: z.object({
    outbox_pending: z.int().min(0), outbox_failed: z.int().min(0), last_revalidated_at: dateTimeSchema.nullable(),
  }),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
