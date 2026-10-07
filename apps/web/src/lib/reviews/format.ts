// F-076 (docs/04 §8, regula 7): formaty opinii wylacznie przez Intl - liczba z odmiana (PluralRules w domenie),
// srednia z przecinkiem, data w strefie Europe/Warsaw. Czyste funkcje.
import { formatCount, type PluralForms } from "@taktyl/domain";

export const REVIEW_FORMS: PluralForms = { one: "opinia", few: "opinie", many: "opinii" };

const avgFormat = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeZone: "Europe/Warsaw",
});

/** "4,6 · 5 opinii"; bez opinii "Brak opinii". Srednia zawsze z liczba opinii (docs/04 §8). */
export function reviewSummary(avg: number | null, count: number): string {
  if (count === 0 || avg === null) return "Brak opinii";
  return `${avgFormat.format(avg)} · ${formatCount(count, REVIEW_FORMS)}`;
}

/** Data "2026-09-14" -> "14 września 2026" (poludnie UTC, wiec ten sam dzien w Warszawie). */
export function reviewDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T12:00:00Z`));
}

/** Tekst dla czytnika: "Ocena: 4 z 5". */
export function ratingText(rating: number): string {
  return `Ocena: ${rating} z 5`;
}

/** Znaki gwiazdek (zwykle znaki Unicode, bez grafiki): "★★★★☆". Dekoracja, ukrywana przed czytnikiem. */
export function starChars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}
