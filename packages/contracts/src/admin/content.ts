// B-030...B-033 (docs/16 §3.4): tresci, opinie demo, wiadomosci.
import { z } from "zod";
import { profileIdSchema } from "../shared/enums";
import { pageOf, pageQuerySchema } from "../shared/pagination";
import { dateTimeSchema, productIdSchema, slugSchema, versionSchema } from "../shared/primitives";
import { REVIEWS_LABEL, reviewSchema } from "../public/content";
import { adminWarningSchema } from "./catalog";

export const contentTypeSchema = z.enum(["page", "guide", "faq"]);
export const contentStatusSchema = z.enum(["draft", "published", "archived"]);

export const adminContentSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  type: contentTypeSchema,
  title: z.string(),
  lead: z.string().nullable(),
  body_md: z.string(),
  status: contentStatusSchema,
  demo_notice: z.boolean(),
  guide_profile: profileIdSchema.nullable(),
  published_at: dateTimeSchema.nullable(),
  version: versionSchema,
  updated_at: dateTimeSchema,
});
export const adminContentListQuerySchema = z.object({ type: contentTypeSchema.optional() });
export const adminContentListSchema = z.object({ items: z.array(adminContentSchema) });

export const contentCreateSchema = z.strictObject({
  slug: slugSchema,
  type: contentTypeSchema,
  title: z.string().trim().min(2).max(160),
  lead: z.string().trim().max(400).nullable().optional(),
  body_md: z.string().max(50_000),
  status: contentStatusSchema.default("draft"),
  demo_notice: z.boolean().default(false),
  guide_profile: profileIdSchema.nullable().optional(),
});
export const contentPatchSchema = z
  .strictObject({
    title: z.string().trim().min(2).max(160).optional(),
    lead: z.string().trim().max(400).nullable().optional(),
    body_md: z.string().max(50_000).optional(),
    status: contentStatusSchema.optional(),
    demo_notice: z.boolean().optional(),
    guide_profile: profileIdSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "pusty PATCH");

/** PUT /products/{id}/reviews: 3-6 opinii, oceny 3-5, demo: true wymuszone. */
export const reviewsPutSchema = z.strictObject({
  items: z
    .array(reviewSchema.extend({ rating: z.int().min(3).max(5) }))
    .min(3)
    .max(6),
});

export const adminMessageSchema = z.object({
  id: z.string(),
  kind: z.enum(["contact", "newsletter"]),
  email: z.string(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
  created_at: dateTimeSchema,
  handled: z.boolean().nullable(),
});
export const adminMessageListSchema = pageOf(adminMessageSchema);
export const adminMessageListQuerySchema = pageQuerySchema.extend({
  kind: z.enum(["contact", "newsletter"]).optional(),
});

/** Odpowiedz zapisu tresci: wersja po sanityzacji (docs/16 par. 3.4) i ostrzezenia (np. dlugosc artykulu, usunieto niedozwolone znaczniki). */
export const adminContentResponseSchema = adminContentSchema.extend({
  warnings: z.array(adminWarningSchema),
});

/** B-300, B-301: opis produktu (tekst, akapity rozdzielone pusta linia); zakazane slowa i dlugosc to ostrzezenia, nie blokada. */
export const descriptionPutSchema = z.strictObject({
  description: z.string().max(3000).nullable(),
});
export const descriptionResponseSchema = z.object({
  product_id: productIdSchema,
  description: z.string().nullable(),
  version: versionSchema,
  stats: z.object({ words: z.int().min(0), paragraphs: z.int().min(0) }),
  warnings: z.array(adminWarningSchema),
});

/** B-302, B-303: opinie demo pogrupowane po produkcie; etykieta jest stala i nieusuwalna. */

export const adminProductReviewsSchema = z.object({
  product_id: productIdSchema,
  slug: slugSchema,
  name: z.string(),
  avg: z.number().min(1).max(5).nullable(),
  count: z.int().min(0),
  items: z.array(reviewSchema),
});
export const adminReviewListQuerySchema = z.object({ product_id: productIdSchema.optional() });
export const adminReviewListSchema = z.object({
  label: z.literal(REVIEWS_LABEL),
  items: z.array(adminProductReviewsSchema),
});

/** B-307: FAQ jako uporzadkowana lista (kolejnosc = pozycja w tablicy, takze przyciskami Wyzej/Nizej). */
export const adminFaqItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer_md: z.string(),
  position: z.int().min(1),
  status: z.enum(["draft", "published", "archived"]),
});
export const adminFaqSchema = z.object({
  items: z.array(adminFaqItemSchema),
  warnings: z.array(adminWarningSchema),
});
export const faqPutSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(40).optional(),
        question: z.string().trim().min(5).max(200),
        answer_md: z.string().trim().min(5).max(3000),
        status: z.enum(["draft", "published", "archived"]).default("published"),
      }),
    )
    .max(50),
});

/** B-308: oznaczenie zgloszenia jako obsluzone (tylko wiadomosci kontaktowe). */
export const messagePatchSchema = z.strictObject({ handled: z.boolean() });
