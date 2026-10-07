// docs/16 §1: paginacja stronami (admin, zamowienia) i kursor (katalog publiczny, F-026).
import { z } from "zod";

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.int().min(1),
    per_page: z.int().min(1).max(100),
    total: z.int().min(0),
  });

export const cursorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(48).default(12),
  cursor: z.string().min(1).max(512).optional(),
});

export const cursorOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    next_cursor: z.string().nullable(),
    total: z.int().min(0),
  });
