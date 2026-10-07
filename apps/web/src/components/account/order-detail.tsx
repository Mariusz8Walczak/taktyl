"use client";
// F-202 (docs/05 §1 `/konto/zamowienia/{id}`; wzorzec: szczegoly zamowienia konta, docs/08 §6): pozycje, kwoty z API
// (grosze -> Intl), dostawa, platnosc, status i przebieg. Publiczne API zwraca biezacy status i status platnosci, nie
// pelna historie zmian (ta jest w backpanelu), wiec przebieg skladamy z dat i stanow zamowienia (docs/decyzje.md WEB-156).
// Zamowienie czyta `order_token` z tej przegladarki; brak tokenu / 401 / 404 = komunikat.
import type { OrderDetail } from "@taktyl/contracts";
import { formatCivilDate, formatPLN } from "@taktyl/domain";
import Link from "next/link";
import { ORDER_STATUS_LABEL, formatDateTime, lineTotalGr } from "../../lib/account/orders";
import { parseIsoDate } from "../../lib/catalog/dispatch";
import { formatDiscount } from "../../lib/cart/messages";
import { useOrder } from "../checkout/use-order";
import type { OrderPageSettings } from "../checkout/order-pages";
import { ORDER_ERROR_TEXT, ORDER_MISSING_TEXT } from "./orders-list";

const PAYMENT_STATUS: Record<OrderDetail["payment"]["status"], string> = {
  created: "Czeka na zasymulowanie płatności",
  paid: "Płatność zasymulowana",
  failed: "Płatność odrzucona (symulacja)",
};

function historyOf(order: OrderDetail, tz: string): { label: string; at: string | null }[] {
  const out: { label: string; at: string | null }[] = [
    { label: "Zamówienie złożone", at: formatDateTime(order.created_at, tz) },
    { label: PAYMENT_STATUS[order.payment.status], at: null },
  ];
  if (order.payment.attempts > 1) {
    out.push({ label: `Liczba prób płatności: ${order.payment.attempts}`, at: null });
  }
  out.push({ label: `Obecny status: ${ORDER_STATUS_LABEL[order.status]}`, at: null });
  return out;
}

export function OrderDetailView({
  number,
  settings,
}: {
  number: string;
  settings: OrderPageSettings;
}) {
  const { load } = useOrder(number);
  const tz = settings.timeZone;

  if (load.state === "loading") {
    return (
      <p className="konto__stan" role="status">
        Wczytuję zamówienie…
      </p>
    );
  }
  if (load.state === "missing" || load.state === "error") {
    return (
      <div className="pusty-stan">
        <p className="pusty-stan__tekst" role="alert">
          {load.state === "missing" ? ORDER_MISSING_TEXT : ORDER_ERROR_TEXT}
        </p>
        <div className="pusty-stan__akcje">
          <Link href="/konto/zamowienia" className="tk-btn tk-btn--poboczny">
            Wróć do zamówień
          </Link>
        </div>
      </div>
    );
  }

  const order = load.order;
  const eta = order.eta;
  return (
    <article className="konto-szczegoly" aria-labelledby="zamowienie-tytul">
      <h2 id="zamowienie-tytul" className="konto-szczegoly__tytul">
        Zamówienie {order.number}
      </h2>
      <p className="konto-szczegoly__status">
        <strong>{ORDER_STATUS_LABEL[order.status]}</strong> · złożone{" "}
        {formatDateTime(order.created_at, tz)}
      </p>

      <h3 className="konto-szczegoly__podtytul">Pozycje</h3>
      <ul className="lista konto-szczegoly__pozycje">
        {order.items.map((i, idx) => (
          <li key={`${i.sku}-${idx}`}>
            <span>
              <strong>{i.name}</strong>
              {i.variant_label ? ` · ${i.variant_label}` : ""} × {i.qty}
              {i.group_id ? " · w secie" : ""}
            </span>
            <span>{formatPLN(lineTotalGr(i))}</span>
          </li>
        ))}
      </ul>

      <dl className="konto-szczegoly__sumy">
        <div>
          <dt>Wartość produktów</dt>
          <dd>{formatPLN(order.items_gr)}</dd>
        </div>
        {order.set_discount_gr > 0 ? (
          <div>
            <dt>Rabat za set</dt>
            <dd>{formatDiscount(order.set_discount_gr)}</dd>
          </div>
        ) : null}
        {order.coupon_discount_gr > 0 ? (
          <div>
            <dt>Kod {order.coupon_code}</dt>
            <dd>{formatDiscount(order.coupon_discount_gr)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Dostawa</dt>
          <dd>{order.shipping_gr === 0 ? "Darmowa" : formatPLN(order.shipping_gr)}</dd>
        </div>
        <div className="konto-szczegoly__razem">
          <dt>Razem</dt>
          <dd>{formatPLN(order.total_gr)}</dd>
        </div>
      </dl>

      <h3 className="konto-szczegoly__podtytul">Dostawa i płatność</h3>
      <dl className="konto-szczegoly__dane">
        <div>
          <dt>Sposób dostawy</dt>
          <dd>{settings.shippingLabels[order.shipping_method] ?? order.shipping_method}</dd>
        </div>
        {eta ? (
          <>
            <div>
              <dt>Wysyłka</dt>
              <dd>{formatCivilDate(parseIsoDate(eta.dispatch_date), tz)}</dd>
            </div>
            <div>
              <dt>Planowana dostawa</dt>
              <dd>{formatCivilDate(parseIsoDate(eta.delivery_date), tz)}</dd>
            </div>
          </>
        ) : null}
        <div>
          <dt>Płatność</dt>
          <dd>{settings.paymentLabels[order.payment.type] ?? order.payment.type} (symulacja)</dd>
        </div>
      </dl>

      <h3 className="konto-szczegoly__podtytul">Przebieg</h3>
      <ol className="lista konto-szczegoly__przebieg">
        {historyOf(order, tz).map((h) => (
          <li key={h.label}>
            {h.label}
            {h.at ? <span className="konto-szczegoly__czas"> · {h.at}</span> : null}
          </li>
        ))}
      </ol>
      <p className="konto-szczegoly__demo">{settings.demoLabel}</p>
    </article>
  );
}
