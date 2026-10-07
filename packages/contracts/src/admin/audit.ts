// B-060, B-061, B-002 (docs/16 §3.5, docs/17 §3.6, docs/14 §6): audit_log, outbox, znaczniki rewalidacji, dashboard.
import { z } from "zod";
import { roleSchema } from "../shared/enums";
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

export const dashboardSchema = z.object({
  orders_to_handle: z.int().min(0), low_stock: z.int().min(0), missing_images: z.int().min(0), failed_webhooks: z.int().min(0),
});
