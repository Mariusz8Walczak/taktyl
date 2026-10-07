// B-500..B-508 (docs/15 par. 11, docs/16 par. 3.5, docs/09): manifest zdjec i wgrywanie plikow dostarczonych przez czlowieka.
// Backpanel i API nie tworza obrazow; przyjmuja tylko pliki WebP zgodne z manifestem.
import { z } from "zod";
import { pageOf, pageQuerySchema } from "../shared/pagination";
import { dateTimeSchema } from "../shared/primitives";

/** Jedyny dozwolony typ wgrywanego pliku (docs/15 B-502: "Wgraj plik WebP."); inny = 415. */
export const MEDIA_ALLOWED_TYPES = ["image/webp"] as const;
export const mediaKindSchema = z.enum(["packshot", "topdown", "texture"]);
export const mediaStatusSchema = z.enum(["gotowe", "brak"]);
export const mediaPrioritySchema = z.enum(["P0", "P1"]);
/** Nazwa miejsca na plik: szerokosci packshotu albo gestosc topdown/texture. */
export const mediaSlotSchema = z.enum(["400", "800", "1600", "1x", "2x"]);
export type MediaSlot = z.infer<typeof mediaSlotSchema>;

/** Jedno oczekiwane miejsce na plik: nazwa pliku pochodzi z manifestu, nigdy z uploadu. */
export const mediaSlotSpecSchema = z.object({
  slot: mediaSlotSchema,
  /** sama nazwa pliku, np. k-kwarc-60_grafit_top@1x.webp */
  file_name: z.string(),
  /** sciezka z manifestu, np. img/top/k-kwarc-60_grafit_top@1x.webp */
  path: z.string(),
  width: z.int().min(1),
  height: z.int().min(1),
  /** czy plik lezy w wolumenie media */
  present: z.boolean(),
  /** adres publiczny (MEDIA_PUBLIC_URL + sciezka) tylko gdy plik jest */
  url: z.string().nullable(),
});

export const mediaEntrySchema = z.object({
  key: z.string(),
  product_id: z.string(),
  product_slug: z.string().nullable(),
  product_name: z.string().nullable(),
  color: z.string(),
  kind: mediaKindSchema,
  shot: z.string().nullable(),
  description: z.string().nullable(),
  priority: mediaPrioritySchema,
  status: mediaStatusSchema,
  /** wymiary w mm (topdown); null dla packshot i texture */
  dims_mm: z.object({ w: z.int(), d: z.int() }).nullable(),
  pixels: z.record(z.string(), z.tuple([z.int(), z.int()])).nullable(),
  slots: z.array(mediaSlotSpecSchema),
  updated_at: dateTimeSchema,
});
export type MediaEntry = z.infer<typeof mediaEntrySchema>;

export const mediaListQuerySchema = pageQuerySchema.extend({
  per_page: z.coerce.number().int().min(1).max(200).default(50),
  status: mediaStatusSchema.optional(),
  kind: mediaKindSchema.optional(),
  priority: mediaPrioritySchema.optional(),
  product_id: z.string().max(80).optional(),
  q: z.string().max(80).optional(),
});

/** B-501/B-605: licznik liczony z danych, nie z liczby wpisanej na stale. */
export const mediaProgressSchema = z.object({
  p0_ready: z.int().min(0),
  p0_total: z.int().min(0),
  total_ready: z.int().min(0),
  total: z.int().min(0),
});
export type MediaProgress = z.infer<typeof mediaProgressSchema>;

/** GET /v1/admin/media: `items` po filtrach, `progress` zawsze z calego manifestu. */
export const mediaListSchema = pageOf(mediaEntrySchema).extend({
  per_page: z.int().min(1).max(200),
  progress: mediaProgressSchema,
});

export const mediaWarningSchema = z.object({
  /** no_alpha: plik bez przezroczystego tla (B-505), ostrzezenie, nie blokada */
  code: z.enum(["no_alpha"]),
  slot: mediaSlotSchema,
  message: z.string(),
});

/** POST /v1/admin/media/{key} (multipart; pole pliku = nazwa miejsca, np. `1x`, `2x`, `400`) i DELETE. */
export const mediaUploadResponseSchema = z.object({
  entry: mediaEntrySchema,
  uploaded: z.array(mediaSlotSchema),
  /** miejsca, ktorych nadal brakuje; status zmienia sie na `gotowe`, gdy lista jest pusta */
  missing: z.array(mediaSlotSchema),
  warnings: z.array(mediaWarningSchema),
  progress: mediaProgressSchema,
});
export type MediaUploadResponse = z.infer<typeof mediaUploadResponseSchema>;

/** Kody pol w `errors[].code` odpowiedzi 415/422/413 uploadu. */
export const mediaUploadErrorCodeSchema = z.enum([
  "unsupported_type",
  "dimensions_mismatch",
  "file_too_large",
  "unknown_slot",
  "no_file",
]);
