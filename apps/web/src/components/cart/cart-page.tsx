"use client";
// F-151...F-157, A-11 (docs/05 §6; wzorzec: `view-cart.html`, docs/08 §6): strona /koszyk. H1 + licznik (PluralRules),
// pasek do darmowej dostawy, lista pozycji i grup setow, pole kodu, przyklejone podsumowanie, "Dokoncz set".
// Ceny z `POST /cart/quote` (bez cache); blad sieci = komunikat, koszyk zostaje zapisany; stany sprawdzane przy otwarciu (F-157).
import { Alert, Button } from "@taktyl/ui";
import { useEffect, useState } from "react";
import "../../styles/cart.css";
import { unitsText } from "../../lib/cart/messages";
import { QUOTE_ERROR_TEXT, hasBlockingProblems, useCartQuote } from "../../lib/cart/quote";
import { cartStore, useCart } from "../../lib/cart/store";
import { countUnits } from "../../lib/cart/state";
import { CartLines } from "./cart-lines";
import {
  CartSkeleton,
  CouponForm,
  EmptyCartMessage,
  FreeShippingBar,
  SummaryRows,
  type CartSettings,
} from "./cart-parts";
import { CompleteSet } from "./complete-set";
import { useCartActions } from "./use-cart-actions";
import { useViewCartOnce } from "./use-view-cart";

export interface CartPageSettings extends CartSettings {
  setDiscountPercent: number;
}

export function CartPage({ settings }: { settings: CartPageSettings }) {
  // Serwer nie zna koszyka: do hydracji pokazujemy szkielet, zeby pusty stan nie mignal przy pelnym koszyku.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cart = useCart();
  const { quote, status, slow, error, reload } = useCartQuote(cart);
  const actions = useCartActions(quote);
  useViewCartOnce(mounted, quote, status);

  const units = countUnits(cart);
  const empty = mounted && cart.lines.length === 0;
  const blocked = hasBlockingProblems(quote);
  const canCheckout = Boolean(quote) && !blocked && status !== "error";

  return (
    <div className="kontener strona koszyk">
      <h1 className="naglowek-strony">Koszyk</h1>
      {mounted && units > 0 ? (
        <p className="koszyk__licznik" data-testid="koszyk-licznik">
          {unitsText(units)}
        </p>
      ) : null}

      {!mounted ? <CartSkeleton /> : null}
      {empty ? <EmptyCartMessage /> : null}

      {mounted && !empty ? (
        <div className="koszyk__uklad">
          <div className="koszyk__lista">
            {quote && status !== "error" ? (
              <FreeShippingBar quote={quote} thresholdGr={settings.freeShippingThresholdGr} />
            ) : null}
            {status === "error" && error ? (
              <Alert variant="uwaga" data-testid="koszyk-blad-wyceny">
                {QUOTE_ERROR_TEXT[error.kind]}{" "}
                <button type="button" className="tk-link tk-link--przycisk" onClick={reload}>
                  Spróbuj ponownie
                </button>
              </Alert>
            ) : null}
            {!quote && status !== "error" && slow ? <CartSkeleton /> : null}
            <CartLines
              lines={cart.lines}
              quote={quote}
              actions={actions}
              busy={status === "loading"}
            />
            <CompleteSet cart={cart} quote={quote} percent={settings.setDiscountPercent} />
          </div>

          <aside className="koszyk__podsumowanie" aria-labelledby="koszyk-podsumowanie">
            <h2 id="koszyk-podsumowanie" className="koszyk__podsumowanie-naglowek">
              Podsumowanie
            </h2>
            <CouponForm
              code={cart.code}
              quote={quote}
              codes={settings.codes}
              onApply={(c) => cartStore.applyCode(c)}
            />
            {quote ? (
              <div
                aria-busy={status === "loading" || undefined}
                className={status === "loading" ? "is-odswiezanie" : undefined}
              >
                <SummaryRows quote={quote} shippingFromGr={settings.shippingFromGr} />
                {quote.summary.free_shipping_remaining_gr > 0 ? (
                  <p className="koszyk__uwaga">
                    Koszt dostawy poznasz po wyborze metody w zamówieniu.
                  </p>
                ) : null}
              </div>
            ) : null}
            {blocked ? (
              <>
                <p id="koszyk-blokada" className="koszyk-blokada" role="alert">
                  Nie możesz przejść dalej, dopóki w koszyku są pozycje bez stanu. Wybierz inny
                  wariant albo usuń pozycję.
                </p>
                <Button disabled aria-describedby="koszyk-blokada" className="koszyk__dalej">
                  Przejdź do zamówienia
                </Button>
              </>
            ) : canCheckout ? (
              <a href="/zamowienie" className="tk-btn tk-btn--glowny koszyk__dalej">
                Przejdź do zamówienia
              </a>
            ) : (
              <Button disabled className="koszyk__dalej">
                Przejdź do zamówienia
              </Button>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
