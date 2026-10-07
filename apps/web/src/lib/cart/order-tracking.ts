// F-178, F-242 (docs/10 §4): `purchase` i `payment_failed` budowane z zamowienia zwroconego przez API
// (ceny w chwili zamowienia). `value` = pozycje po rabatach bez dostawy; `tax` = VAT zawarty w cenie (value * 23 / 123).
// Kod rabatowy idzie jako `coupon`; `discount` pozycji to tylko rabat setu na sztuke (docs/10 §3).
import type { OrderDetail } from "@taktyl/contracts";
import type { PaymentType, TrackEventMap, TrackItem } from "../track-events";
import { buildItem, grToZl, vatIncludedGr } from "../track-items";
import { categoryOfSku } from "./types";

export function orderValueGr(
  o: Pick<OrderDetail, "items_gr" | "set_discount_gr" | "coupon_discount_gr">,
): number {
  return o.items_gr - o.set_discount_gr - o.coupon_discount_gr;
}

export function orderTrackItems(o: OrderDetail): TrackItem[] {
  const setLines = o.items.filter((i) => i.group_id);
  const setBase = setLines.reduce((s, i) => s + i.unit_price_gr * i.qty, 0);
  const setDisc = setLines.reduce((s, i) => s + i.set_discount_gr, 0);
  const percent = setBase > 0 ? Math.round((setDisc * 100) / setBase) : 0;
  return o.items.map((i) =>
    buildItem(
      {
        sku: i.sku,
        name: i.name,
        category: categoryOfSku(i.sku),
        variant: i.variant_label || undefined,
        priceGr: i.unit_price_gr,
        quantity: i.qty,
      },
      i.group_id ? Math.floor(i.set_discount_gr / i.qty) : 0,
      i.group_id ? `Rabat za set ${percent}%` : undefined,
    ),
  );
}

export function purchaseParams(o: OrderDetail): TrackEventMap["purchase"] {
  const valueGr = orderValueGr(o);
  return {
    transaction_id: o.number,
    currency: "PLN",
    value: grToZl(valueGr),
    shipping: grToZl(o.shipping_gr),
    tax: grToZl(vatIncludedGr(valueGr)),
    ...(o.coupon_code ? { coupon: o.coupon_code } : {}),
    items: orderTrackItems(o),
  };
}

export function paymentFailedParams(o: OrderDetail): TrackEventMap["payment_failed"] {
  return {
    transaction_id: o.number,
    payment_type: o.payment.type as PaymentType,
    value: grToZl(orderValueGr(o)),
  };
}
