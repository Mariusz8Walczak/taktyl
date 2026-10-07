"use client";
// F-170, F-155 (docs/05 §7; wzorzec: kolumna zamowienia `checkout.html`, docs/08 §6): podsumowanie kasy. Pozycje zwiniete do
// liczby i rozwijane (details), kwoty z wyceny API; VAT zawarty w cenie liczony tylko tu (wartosc * 23 / 123, grosze).
// Na telefonie: zwiniete nad formularzem ("Pokaż podsumowanie · 1203,30 zł"), na komputerze: kolumna z prawej.
import { formatPLN } from "@taktyl/domain";
import { formatDiscount, unitsText } from "../../lib/cart/messages";
import { countUnits } from "../../lib/cart/state";
import { quoteValueGr } from "../../lib/cart/tracking";
import type { CartState, Quote } from "../../lib/cart/types";
import { vatIncludedGr } from "../../lib/track-items";

export interface SummaryProps {
  cart: CartState;
  quote: Quote | null;
  /** Etykieta wybranej metody dostawy; brak = jeszcze nie wybrano. */
  shippingLabel: string | null;
  busy: boolean;
}

function Lines({ cart, quote }: Pick<SummaryProps, "cart" | "quote">) {
  const items = new Map(
    quote?.lines.flatMap((l) => (l.type === "item" ? [[l.sku, l] as const] : [])),
  );
  const sets = new Map(quote?.lines.flatMap((l) => (l.type === "set" ? [[l.id, l] as const] : [])));
  return (
    <ul className="lista zam-podsumowanie__pozycje">
      {cart.lines.map((l) =>
        l.type === "item" ? (
          <li key={l.sku}>
            <span>
              {items.get(l.sku)?.name ?? l.sku} × {l.qty}
            </span>
          </li>
        ) : (
          <li key={l.id}>
            <span>
              {l.name} × {l.qty}
            </span>
            <span className="zam-podsumowanie__sklad">
              {l.items
                .map((i) => sets.get(l.id)?.items.find((x) => x.sku === i.sku)?.name ?? i.sku)
                .join(", ")}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

export function SummaryBody({
  cart,
  quote,
  shippingLabel,
  busy,
  primary = false,
}: SummaryProps & { primary?: boolean }) {
  const units = countUnits(cart);
  const s = quote?.summary;
  const valueGr = quote ? quoteValueGr(quote) : 0;
  const totalGr = s ? s.total_gr : 0;
  const shippingGr = s ? totalGr - valueGr : 0;
  const free = Boolean(s && s.free_shipping_remaining_gr === 0);
  return (
    <div
      className={busy ? "zam-podsumowanie__tresc is-odswiezanie" : "zam-podsumowanie__tresc"}
      aria-busy={busy || undefined}
    >
      <details className="zam-podsumowanie__pozycje-szczegoly">
        <summary>{unitsText(units)}</summary>
        <Lines cart={cart} quote={quote} />
      </details>
      {s ? (
        <dl className="koszyk-sumy">
          <div>
            <dt>Wartość produktów</dt>
            <dd>{formatPLN(s.products_gr)}</dd>
          </div>
          {s.set_discount_gr > 0 ? (
            <div>
              <dt>Rabat za set</dt>
              <dd>{formatDiscount(s.set_discount_gr)}</dd>
            </div>
          ) : null}
          {s.coupon_discount_gr > 0 ? (
            <div>
              <dt>Kod rabatowy</dt>
              <dd>{formatDiscount(s.coupon_discount_gr)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Dostawa{shippingLabel ? `: ${shippingLabel}` : ""}</dt>
            <dd>
              {shippingLabel
                ? shippingGr === 0
                  ? "Darmowa"
                  : formatPLN(shippingGr)
                : free
                  ? "Darmowa"
                  : "Wybierz metodę"}
            </dd>
          </div>
          <div className="koszyk-sumy__razem">
            <dt>Razem</dt>
            <dd data-testid={primary ? "zamowienie-razem" : undefined}>{formatPLN(totalGr)}</dd>
          </div>
          <div>
            <dt>W tym VAT 23%</dt>
            <dd>{formatPLN(vatIncludedGr(totalGr))}</dd>
          </div>
        </dl>
      ) : (
        <p className="zam-podsumowanie__ladowanie">Liczymy kwoty…</p>
      )}
    </div>
  );
}

export function OrderSummary(props: SummaryProps) {
  const totalGr = props.quote?.summary.total_gr ?? null;
  return (
    <>
      <details className="zam-podsumowanie zam-podsumowanie--telefon">
        <summary className="zam-podsumowanie__przelacznik">
          Pokaż podsumowanie{totalGr !== null ? ` · ${formatPLN(totalGr)}` : ""}
        </summary>
        <SummaryBody {...props} />
      </details>
      <aside
        className="zam-podsumowanie zam-podsumowanie--kolumna"
        aria-labelledby="zam-podsumowanie-naglowek"
      >
        <h2 id="zam-podsumowanie-naglowek" className="zam-podsumowanie__naglowek">
          Podsumowanie
        </h2>
        <SummaryBody {...props} primary />
      </aside>
    </>
  );
}
