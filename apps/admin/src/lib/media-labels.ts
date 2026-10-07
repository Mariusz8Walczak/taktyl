// B-500..B-508 (docs/15 par. 11, docs/09): etykiety rodzajow, statusow i adresow zdjec.
import type { MediaEntry } from "@taktyl/contracts";
import type { PluralForms } from "@taktyl/domain";
import { SITE_URL } from "./format";

export const MEDIA_KIND_LABEL = {
  packshot: "Ujęcie produktu",
  topdown: "Widok z góry",
  texture: "Tekstura",
} as const;
export const MEDIA_STATUS_LABEL = { gotowe: "Gotowe", brak: "Brak" } as const;
export const MEDIA_COUNT: PluralForms = { one: "wpis", few: "wpisy", many: "wpisów" };

/** Wymiary oczekiwane przez miejsce na plik, np. "327 x 140 px" (spacje zwykle: tekst jak w komunikatach API). */
export function slotSize(s: { width: number; height: number }): string {
  return `${s.width} x ${s.height} px`;
}

const CATEGORY_BY_PREFIX: Record<string, string> = { k: "klawiatury", m: "myszki", p: "podkladki" };

/** Adres karty produktu w sklepie dla wpisu manifestu (kategoria z prefiksu id, docs/04 par. 3.1). */
export function shopUrlForEntry(entry: Pick<MediaEntry, "product_id" | "product_slug">): string {
  const category = CATEGORY_BY_PREFIX[entry.product_id.charAt(0)];
  return category && entry.product_slug
    ? `${SITE_URL}/${category}/${entry.product_slug}`
    : SITE_URL;
}
