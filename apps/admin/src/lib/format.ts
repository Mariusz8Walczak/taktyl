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
export const COLOR_LABEL = {
  grafit: "Grafit",
  mgla: "Mgła",
  kobalt: "Kobalt",
  naturalny: "Naturalny",
} as const;
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

/** Adres sklepu (PUBLIC_SITE_URL wbudowany przy budowie obrazu). */
export const SITE_URL = (process.env.PUBLIC_SITE_URL ?? "http://taktyl.localhost").replace(
  /\/$/,
  "",
);

/** Adres karty produktu w sklepie: /{kategoria}/{slug} (docs/05). */
export function shopProductUrl(category: string, slug: string): string {
  return `${SITE_URL}/${category}/${slug}`;
}
