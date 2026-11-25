// Polszczyzna przez Intl (regula 7): kwoty, daty w Europe/Warsaw, liczebniki. Logika w @taktyl/domain.
import { formatCount, formatPLN, pluralize, type PluralForms } from "@taktyl/domain";
import type { OrderStatus } from "@taktyl/contracts";

export { formatCount, formatPLN, pluralize };

const dateTime = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  dateStyle: "medium",
  timeStyle: "short",
});
const time = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
export function formatTime(date: Date): string {
  return time.format(date);
}

export const PRODUCT_COUNT: PluralForms = { one: "produkt", few: "produkty", many: "produktów" };
export const ORDER_COUNT: PluralForms = { one: "zamówienie", few: "zamówienia", many: "zamówień" };
export const ITEM_COUNT: PluralForms = { one: "pozycja", few: "pozycje", many: "pozycji" };
export const VARIANT_COUNT: PluralForms = { one: "wariant", few: "warianty", many: "wariantów" };
export const SET_COUNT: PluralForms = {
  one: "gotowym secie",
  few: "gotowych setach",
  many: "gotowych setach",
};

/** Etykiety statusow zamowien (docs/18 E): angielskie kody w API, polskie nazwy w UI. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Nowe, czeka na płatność",
  payment_failed: "Płatność nieudana",
  paid: "Opłacone",
  processing: "W realizacji",
  shipped: "Wysłane",
  delivered: "Dostarczone",
  cancelled: "Anulowane",
};

export const CATEGORY_LABEL = {
  klawiatury: "Klawiatury",
  myszki: "Myszki",
  podkladki: "Podkładki",
} as const;
/** Etykiety serii; pozostale kolory (kolekcja, ADR-0011) pokazujemy kluczem przez `colorLabel`. */
export const COLOR_LABEL: Record<string, string> = {
  grafit: "Grafit",
  mgla: "Mgła",
  kobalt: "Kobalt",
  naturalny: "Naturalny",
};
export const colorLabel = (id: string): string => COLOR_LABEL[id] ?? id;
export const SERIES_COLORS = ["grafit", "mgla", "kobalt", "naturalny"] as const;
export const SWITCH_LABEL = {
  slizg: "Ślizg",
  prog: "Próg",
  trzask: "Trzask",
  szept: "Szept",
} as const;
export const PAD_SIZE_LABEL = { m: "M", l: "L", xl: "XL", xxl: "XXL" } as const;
export const PAYMENT_LABEL = {
  blik: "BLIK",
  karta: "Karta płatnicza",
  "przelew-online": "Przelew online",
  przelew: "Przelew",
} as const;
export const SHIPPING_LABEL = {
  automat: "Automat paczkowy",
  kurier: "Kurier",
  odbior: "Odbiór osobisty",
} as const;

// ---- B-610..B-620 (docs/25 par. 2): liczby pulpitu przez Intl (regula 7) ----
const pctFmt = new Intl.NumberFormat("pl-PL", { style: "percent", maximumFractionDigits: 1 });
const deltaFmt = new Intl.NumberFormat("pl-PL", {
  style: "percent",
  signDisplay: "exceptZero",
  maximumFractionDigits: 0,
});
const intFmt = new Intl.NumberFormat("pl-PL");
const compactPln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  notation: "compact",
  maximumFractionDigits: 1,
});
const dayShort = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const dayLong = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "long",
});
const minutesFmt = new Intl.NumberFormat("pl-PL", {
  style: "unit",
  unit: "minute",
  unitDisplay: "short",
});
const hoursFmt = new Intl.NumberFormat("pl-PL", {
  style: "unit",
  unit: "hour",
  unitDisplay: "short",
  maximumFractionDigits: 1,
});
const daysFmt = new Intl.NumberFormat("pl-PL", {
  style: "unit",
  unit: "day",
  unitDisplay: "long",
  maximumFractionDigits: 1,
});
const weekdayFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: "UTC", weekday: "short" });

/** Punkty bazowe (10000 = 100 %) jako procent. */
export const formatBp = (bp: number): string => pctFmt.format(bp / 10_000);
/** Zmiana procentowa ze znakiem ("+12%", "-5%"). */
export const formatDelta = (pct: number): string => deltaFmt.format(pct / 100);
export const formatInt = (n: number): string => intFmt.format(n);
/** Kwota w groszach skrotowo na osi wykresu ("12,5 tys. zl"). */
export const formatPLNCompact = (gr: number): string => compactPln.format(gr / 100);
/** Data RRRR-MM-DD jako "7 paz". */
export const formatDayShort = (date: string): string =>
  dayShort.format(new Date(`${date}T12:00:00Z`));
/** Data RRRR-MM-DD jako "sr., 7 pazdziernika". */
export const formatDayLong = (date: string): string =>
  dayLong.format(new Date(`${date}T12:00:00Z`));
/** Czas trwania z minut: minuty, godziny albo dni. */
export function formatMinutes(min: number): string {
  if (min < 60) return minutesFmt.format(min);
  if (min < 48 * 60) return hoursFmt.format(Math.round(min / 6) / 10);
  return daysFmt.format(Math.round(min / 144) / 10);
}
/** Skrot dnia tygodnia (1 = poniedzialek) przez Intl; 23.11.2026 to poniedzialek. */
export const weekdayShort = (dow: number): string =>
  weekdayFmt.format(new Date(Date.UTC(2026, 10, 22 + dow)));
export const SESSION_COUNT: PluralForms = { one: "sesja", few: "sesje", many: "sesji" };
export const PIECE_COUNT: PluralForms = { one: "sztuka", few: "sztuki", many: "sztuk" };
export const DAY_COUNT: PluralForms = { one: "dzień", few: "dni", many: "dni" };

/** Adres sklepu (PUBLIC_SITE_URL wbudowany przy budowie obrazu). */
export const SITE_URL = (process.env.PUBLIC_SITE_URL ?? "http://taktyl.localhost").replace(
  /\/$/,
  "",
);

/** Adres karty produktu w sklepie: /{kategoria}/{slug} (docs/05). */
export function shopProductUrl(category: string, slug: string): string {
  return `${SITE_URL}/${category}/${slug}`;
}
