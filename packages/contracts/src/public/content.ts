// F-076, F-220, F-221 (docs/16 §2): tresci publiczne.
import { z } from "zod";
import { profileIdSchema } from "../shared/enums";
import { dateSchema, dateTimeSchema, slugSchema } from "../shared/primitives";

export const contentPageSchema = z.object({
  slug: slugSchema, type: z.enum(["page", "guide"]), title: z.string(), lead: z.string().nullable(),
  body_md: z.string(), demo_notice: z.boolean(), guide_profile: profileIdSchema.nullable(),
  published_at: dateTimeSchema.nullable(),
});
export const guideListSchema = z.object({
  items: z.array(contentPageSchema.pick({ slug: true, title: true, lead: true, guide_profile: true })),
});
export const faqSchema = z.object({ items: z.array(z.object({ question: z.string(), answer_md: z.string() })) });

/** Opinie demo: demo zawsze true (docs/04 §8, CHECK w bazie). */
export const reviewSchema = z.object({
  author: z.string(), date: dateSchema, rating: z.int().min(1).max(5), variant_label: z.string(), text: z.string(), demo: z.literal(true),
});
/** B-303, F-076: etykieta sekcji opinii jest stala i nieusuwalna (docs/04 par. 8). */
export const REVIEWS_LABEL = "Opinie przykładowe — sklep demonstracyjny" as const;
export const reviewsResponseSchema = z.object({
  label: z.literal(REVIEWS_LABEL), avg: z.number().min(1).max(5).nullable(), count: z.int().min(0),
  items: z.array(reviewSchema),
});
