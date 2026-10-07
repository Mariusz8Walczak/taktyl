// F-151...F-157 (docs/03 §7, docs/12 S13-S16): teksty koszyka i proste odczyty z wyceny. Liczby przez @taktyl/domain.
import { PRODUCT_FORMS, formatCount, formatPLN } from "@taktyl/domain";
import { categoryOfSku, type Quote, type QuoteLineOf } from "./types";

/** Minus typograficzny jak w docs (U+2212), nie lacznik. */
export const MINUS = "−";

/** Rabat jako kwota ze znakiem minus ("−133,70 zł"); liczba przez Intl, znak typograficzny jak w docs. */
export const formatDiscount = (gr: number): string => `${MINUS}${formatPLN(gr)}`;

/** Procent rabatu setu liczony z wyceny (rabat / suma pozycji); API nie wysyla procentu osobno. */
export function setPercentOf(
  line: Pick<QuoteLineOf<"set">, "subtotal_gr" | "set_discount_gr">,
): number {
  return line.subtotal_gr > 0 ? Math.round((line.set_discount_gr * 100) / line.subtotal_gr) : 0;
}

export function setGroupTitle(percent: number): string {
  return percent > 0 ? `Twój set · ${MINUS}${percent}%` : "Twój set";
}

/** Komunikaty kodu z `coupon.message_code` (docs/16 §6.1; teksty sklada klient). */
export function couponText(
  coupon: Quote["coupon"],
  discountGr: number,
): { tone: "sukces" | "uwaga" | "blad"; text: string } | null {
  if (!coupon) return null;
  switch (coupon.message_code) {
    case "coupon_not_for_sets":
      return { tone: "uwaga", text: "Kod nie obejmuje setów — rabat za set jest już naliczony." };
    case "coupon_unknown":
      return { tone: "blad", text: "Nie znamy takiego kodu. Sprawdź pisownię." };
    case "coupon_free_shipping":
      return { tone: "sukces", text: `Kod ${coupon.code}: darmowa dostawa.` };
    case "coupon_applies_outside_sets":
      return {
        tone: "sukces",
        text: `Kod ${coupon.code} obniżył cenę pozycji spoza setów o ${formatPLN(discountGr)}.`,
      };
    default:
      return { tone: "sukces", text: `Kod ${coupon.code} jest zastosowany.` };
  }
}

export const FREE_SHIPPING_REACHED = "Dostawa jest darmowa.";
export const freeShippingText = (remainingGr: number): string =>
  remainingGr > 0 ? `Brakuje ${formatPLN(remainingGr)} do darmowej dostawy` : FREE_SHIPPING_REACHED;

export const SET_SPLIT_TEXT = (percent: number): string =>
  `Set rozdzielony — rabat ${percent > 0 ? `${percent}% ` : ""}usunięty.`;

export const EMPTY_CART_TEXT = "Koszyk jest pusty. Zacznij od kreatora setu albo od klawiatury.";

/** "3 produkty" z liczby sztuk (Intl.PluralRules przez domene). */
export const unitsText = (units: number): string => formatCount(units, PRODUCT_FORMS);

/** Opis problemu z magazynem pozycji (F-157). */
export function stockProblemText(availableQty: number | undefined): string {
  return availableQty && availableQty > 0
    ? `W magazynie zostało ${availableQty} szt. Zmniejsz ilość albo wybierz inny wariant.`
    : "Brak w tym wariancie. Wybierz inny wariant albo usuń pozycję.";
}

/** Adres kreatora na kroku z danym SKU (F-157, F-154): zachowuje wybrane SKU, profil i grupe do edycji. */
export function builderHref(opts: {
  skus: readonly string[];
  profile?: string | null;
  step?: "klawiatura" | "myszka" | "podkladka" | "podsumowanie";
  editId?: string;
}): string {
  const p = new URLSearchParams();
  for (const sku of opts.skus) {
    const c = categoryOfSku(sku);
    p.set(c === "klawiatury" ? "k" : c === "myszki" ? "m" : "p", sku);
  }
  if (opts.profile) p.set("profil", opts.profile);
  p.set("krok", opts.step ?? "podsumowanie");
  if (opts.editId) p.set("edytuj", opts.editId);
  return `/zbuduj-set?${p.toString()}`;
}
