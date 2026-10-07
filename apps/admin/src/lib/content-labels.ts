// B-300..B-310 (docs/15 par. 9): etykiety i adresy sklepu dla ekranow tresci. Teksty interfejsu na ty, bez emoji.
import type { ProfileId } from "@taktyl/contracts";
import type { PluralForms } from "@taktyl/domain";
import { SITE_URL } from "./format";

/** B-305: naglowek wstawiany przez sklep na stronach demo (docs/05 par. 8); w panelu tylko do odczytu. */
export const DEMO_NOTICE_TEXT =
  "Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.";

/** B-303: stala etykieta opinii przykladowych (REVIEWS_LABEL w kontrakcie); panel pokazuje ja w podgladzie. */
export const REVIEWS_PREVIEW_LABEL = "Opinie przykładowe — sklep demonstracyjny";

/** Etykiety profili kreatora z data/rules.json (B-304: profil do koncowego odnosnika artykulu). */
export const PROFILE_LABEL: Record<ProfileId, string> = {
  fps: "Gry FPS, niski sens",
  gry: "Gry (inne)",
  programowanie: "Programowanie",
  biuro: "Praca biurowa",
  cisza: "Cicha praca (open space)",
};

export const CONTENT_STATUS_LABEL = {
  draft: "Szkic",
  published: "Zatwierdzony",
  archived: "Zarchiwizowany",
} as const;

export const PAGE_COUNT: PluralForms = { one: "strona", few: "strony", many: "stron" };
export const GUIDE_COUNT: PluralForms = { one: "artykuł", few: "artykuły", many: "artykułów" };
export const REVIEW_COUNT: PluralForms = { one: "opinia", few: "opinie", many: "opinii" };
export const MESSAGE_COUNT: PluralForms = {
  one: "zgłoszenie",
  few: "zgłoszenia",
  many: "zgłoszeń",
};
export const WORD_COUNT: PluralForms = { one: "słowo", few: "słowa", many: "słów" };
export const PARAGRAPH_COUNT: PluralForms = { one: "akapit", few: "akapity", many: "akapitów" };

/** Adres tresci w sklepie (docs/05): strony /{slug}, poradnik /poradnik/{slug}. */
export function shopContentUrl(type: "page" | "guide", slug: string): string {
  return type === "guide" ? `${SITE_URL}/poradnik/${slug}` : `${SITE_URL}/${slug}`;
}
export const SHOP_FAQ_URL = `${SITE_URL}/faq`;
