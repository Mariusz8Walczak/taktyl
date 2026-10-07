// B-030...B-033 (docs/16 §3.4): tresci, opinie demo, wiadomosci.
import { z } from "zod";
import { profileIdSchema } from "../shared/enums";
import { pageOf, pageQuerySchema } from "../shared/pagination";
import { dateTimeSchema, slugSchema, versionSchema } from "../shared/primitives";
import { reviewSchema } from "../public/content";

export const contentTypeSchema = z.enum(["page", "guide", "faq"]);
export const contentStatusSchema = z.enum(["draft", "published", "archived"]);

export const adminContentSchema = z.object({
  id: z.string(), slug: slugSchema, type: contentTypeSchema, title: z.string(), lead: z.string().nullable(),
  body_md: z.string(), status: contentStatusSchema, demo_notice: z.boolean(), guide_profile: profileIdSchema.nullable(),
  published_at: dateTimeSchema.nullable(), version: versionSchema, updated_at: dateTimeSchema,
});
export const adminContentListQuerySchema = z.object({ type: contentTypeSchema.optional() });
export const adminContentListSchema = z.object({ items: z.array(adminContentSchema) });

export const contentCreateSchema = z.strictObject({
  slug: slugSchema, type: contentTypeSchema, title: z.string().trim().min(2).max(160),
  lead: z.string().trim().max(400).nullable().optional(), body_md: z.string().max(50_000),
  status: contentStatusSchema.default("draft"), demo_notice: z.boolean().default(false),
  guide_profile: profileIdSchema.nullable().optional(),
});
export const contentPatchSchema = z
  .strictObject({
    title: z.string().trim().min(2).max(160).optional(), lead: z.string().trim().max(400).nullable().optional(),
    body_md: z.string().max(50_000).optional(), status: contentStatusSchema.optional(),
    demo_notice: z.boolean().optional(), guide_profile: profileIdSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "pusty PATCH");

/** PUT /products/{id}/reviews: 3-6 opinii, oceny 3-5, demo: true wymuszone. */
export const reviewsPutSchema = z.strictObject({
  items: z.array(reviewSchema.extend({ rating: z.int().min(3).max(5) })).min(3).max(6),
});

export const adminMessageSchema = z.object({
  id: z.string(), kind: z.enum(["contact", "newsletter"]), email: z.string(), subject: z.string().nullable(),
  body: z.string().nullable(), created_at: dateTimeSchema, handled: z.boolean().nullable(),
});
export const adminMessageListSchema = pageOf(adminMessageSchema);
export const adminMessageListQuerySchema = pageQuerySchema.extend({ kind: z.enum(["contact", "newsletter"]).optional() });
