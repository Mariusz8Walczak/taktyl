// F-242 (docs/10 §3-§4): zdarzenia koszyka i kasy budowane z wyceny API (ceny nigdy z koszyka). Kwoty w groszach
// zamieniane na zlote dopiero w buildItem/grToZl; rabat setu na sztuke pochodzi z `set_discount_gr` pozycji wyceny.
import { track } from "../track";
import type { PaymentType, ShippingTier, TrackItem } from "../track-events";
import { buildItem, grToZl } from "../track-items";
import { setPercentOf } from "./messages";
import { categoryOfSku, type Quote, type QuoteLineOf } from "./types";

const base = (
  sku: string,
  name: string,
  priceGr: number,
  quantity: number,
  discountGr = 0,
  promo?: string,
) => buildItem({ sku, name, category: categoryOfSku(sku), priceGr, quantity }, discountGr, promo);

export const promotionName = (percent: number) => `Rabat za set ${percent}%`;

export function setLineItems(line: QuoteLineOf<"set">): TrackItem[] {
  const promo = promotionName(setPercentOf(line));
  return line.items.map((i) => base(i.sku, i.name, i.price_gr, line.qty, i.set_discount_gr, promo));
}

export function itemLineItem(line: QuoteLineOf<"item">): TrackItem {
  return base(line.sku, line.name, line.price_gr, line.qty);
}

export function quoteItems(quote: Quote): TrackItem[] {
  return quote.lines.flatMap((l) => (l.type === "set" ? setLineItems(l) : [itemLineItem(l)]));
}

/** Wartosc koszyka po rabatach, bez dostawy (docs/10 §4): produkty - rabat setu - rabat kodu. */
export function quoteValueGr(quote: Quote): number {
  const s = quote.summary;
  return s.products_gr - s.set_discount_gr - s.coupon_discount_gr;
}

export function trackViewCart(quote: Quote): void {
  track("view_cart", {
    items: quoteItems(quote),
    currency: "PLN",
    value: grToZl(quoteValueGr(quote)),
  });
}

export function trackBeginCheckout(quote: Quote): void {
  const coupon = quote.coupon?.applied ? quote.coupon.code : undefined;
  track("begin_checkout", {
    items: quoteItems(quote),
    currency: "PLN",
    value: grToZl(quoteValueGr(quote)),
    ...(coupon ? { coupon } : {}),
  });
}

export function trackShippingInfo(quote: Quote, tier: ShippingTier): void {
  const coupon = quote.coupon?.applied ? quote.coupon.code : undefined;
  track("add_shipping_info", {
    items: quoteItems(quote),
    currency: "PLN",
    value: grToZl(quoteValueGr(quote)),
    shipping_tier: tier,
    ...(coupon ? { coupon } : {}),
  });
}

export function trackPaymentInfo(
  items: TrackItem[],
  valueGr: number,
  type: PaymentType,
  coupon?: string,
): void {
  track("add_payment_info", {
    items,
    currency: "PLN",
    value: grToZl(valueGr),
    payment_type: type,
    ...(coupon ? { coupon } : {}),
  });
}

/** remove_from_cart: cala pozycja albo grupa (z rabatem setu), wartosc po rabacie setu. */
export function trackRemoveItems(items: TrackItem[]): void {
  const gr = items.reduce(
    (sum, i) => sum + (Math.round(i.price * 100) - Math.round(i.discount * 100)) * i.quantity,
    0,
  );
  track("remove_from_cart", { items, currency: "PLN", value: grToZl(gr) });
}

/** add_to_cart dla setu (grupy) z rozbiciem rabatu na pozycje; uzywane np. przez "Dokoncz set". */
export function trackAddSet(
  lines: readonly { sku: string; name: string; priceGr: number }[],
  discountPerLineGr: readonly number[],
  percent: number,
): void {
  const items = lines.map((l, i) =>
    base(l.sku, l.name, l.priceGr, 1, discountPerLineGr[i] ?? 0, promotionName(percent)),
  );
  const gr = items.reduce(
    (s, i) => s + Math.round(i.price * 100) - Math.round(i.discount * 100),
    0,
  );
  track("add_to_cart", { items, currency: "PLN", value: grToZl(gr) });
}
