"use client";
// F-150, F-157, A-03, A-12 (wzorzec: koszyk wyskakujacy szablonu, docs/08 §6): szuflada koszyka z prawej. Modul nakladek
// @taktyl/ui: pulapka fokusu, Esc, tlo, powrot fokusu na element, ktory ja wywolal (przycisk "Dodaj do koszyka").
// Pozycje i grupy setow ("Twoj set · −10%"), pasek darmowej dostawy, suma, "Przejdz do zamowienia" i "Zobacz koszyk";
// pusty stan z dwoma przyciskami. Ceny z wyceny API; wariant bez stanu blokuje przejscie dalej.
import { formatPLN } from "@taktyl/domain";
import { Alert, Button, Drawer } from "@taktyl/ui";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import "../../styles/cart.css";
import { QUOTE_ERROR_TEXT, hasBlockingProblems, useCartQuote } from "../../lib/cart/quote";
import { useCart } from "../../lib/cart/store";
import { cartUi, useCartDrawerOpen } from "../../lib/cart/ui";
import { quoteValueGr } from "../../lib/cart/tracking";
import { CartLines } from "./cart-lines";
import { CartSkeleton, EmptyCartMessage, FreeShippingBar } from "./cart-parts";
import { useCartActions } from "./use-cart-actions";
import { useViewCartOnce } from "./use-view-cart";

/** Prog darmowej dostawy z ustawien jest znany tylko stronie serwerowej; szuflada bierze go z wyceny (pasek: remaining). */
export default function CartDrawer() {
  const open = useCartDrawerOpen();
  const cart = useCart();
  const { quote, status, slow, error, reload } = useCartQuote(cart, { enabled: open });
  const actions = useCartActions(quote);
  const pathname = usePathname();
  useViewCartOnce(open, quote, status);
  // zmiana adresu zamyka szuflade (nawigacja w obrebie aplikacji nie przeladowuje strony)
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (firstPath.current !== pathname) cartUi.close();
    firstPath.current = pathname;
  }, [pathname]);

  const close = () => cartUi.close();
  const blocked = hasBlockingProblems(quote);
  const empty = cart.lines.length === 0;
  const loadingFirst = !quote && (status === "loading" || status === "idle") && !empty;
  const thresholdGr = quote ? quoteValueGr(quote) + quote.summary.free_shipping_remaining_gr : 0;

  const footer = empty ? null : (
    <div className="koszyk-szuflada__stopka">
      <p className="koszyk-szuflada__suma">
        <span>Suma</span>
        <strong data-testid="szuflada-suma">{quote ? formatPLN(quoteValueGr(quote)) : ""}</strong>
      </p>
      {blocked ? (
        <>
          <p id="szuflada-blokada" className="koszyk-blokada">
            Nie możesz przejść dalej, dopóki w koszyku są pozycje bez stanu.
          </p>
          <Button disabled aria-describedby="szuflada-blokada">
            Przejdź do zamówienia
          </Button>
        </>
      ) : quote ? (
        <a href="/zamowienie" className="tk-btn tk-btn--glowny" onClick={close}>
          Przejdź do zamówienia
        </a>
      ) : (
        <Button disabled>Przejdź do zamówienia</Button>
      )}
      <a href="/koszyk" className="tk-btn tk-btn--poboczny" onClick={close}>
        Zobacz koszyk
      </a>
    </div>
  );

  return (
    <Drawer open={open} onClose={close} title="Koszyk" footer={footer} className="koszyk-szuflada">
      {empty ? (
        <EmptyCartMessage onNavigate={close} />
      ) : (
        <>
          {quote && status !== "error" ? (
            <FreeShippingBar quote={quote} thresholdGr={thresholdGr} />
          ) : null}
          {status === "error" && error ? (
            <Alert variant="uwaga">
              {QUOTE_ERROR_TEXT[error.kind]}{" "}
              <button type="button" className="tk-link tk-link--przycisk" onClick={reload}>
                Spróbuj ponownie
              </button>
            </Alert>
          ) : null}
          {loadingFirst && slow ? <CartSkeleton /> : null}
          <CartLines
            lines={cart.lines}
            quote={quote}
            actions={actions}
            compact
            level={3}
            busy={status === "loading"}
            onNavigate={close}
          />
        </>
      )}
    </Drawer>
  );
}
