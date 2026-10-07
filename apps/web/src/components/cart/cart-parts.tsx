"use client";
// F-152, F-153, F-155, F-156 (docs/05 §6; wzorzec: podsumowanie `view-cart.html`, pole kodu, pasek postepu): male klocki
// koszyka wspolne dla szuflady i strony. A-11: wypelnienie paska to `transform: scaleX`, tekst zmienia sie po progu.
import { formatPLN } from "@taktyl/domain";
import { Alert, Button, Field } from "@taktyl/ui";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  EMPTY_CART_TEXT,
  couponText,
  formatDiscount,
  freeShippingText,
} from "../../lib/cart/messages";
import { quoteValueGr } from "../../lib/cart/tracking";
import type { Quote } from "../../lib/cart/types";

/** Ustawienia sklepu potrzebne w koszyku (z `GET /v1/shop-settings`, przekazane ze strony serwerowej). */
export interface CartSettings {
  freeShippingThresholdGr: number;
  /** Najtansza platna metoda dostawy ("od 12,99 zł" przed wyborem metody). */
  shippingFromGr: number;
  codes: { code: string; label: string }[];
}

/** A-11 (F-152): pasek do darmowej dostawy; prog z ustawien, wartosc po rabatach z wyceny. */
export function FreeShippingBar({ quote, thresholdGr }: { quote: Quote; thresholdGr: number }) {
  const remaining = quote.summary.free_shipping_remaining_gr;
  const ratio = remaining === 0 ? 1 : Math.max(0, Math.min(1, quoteValueGr(quote) / thresholdGr));
  return (
    <div className="koszyk-dostawa">
      <p className="koszyk-dostawa__tekst" role="status">
        {freeShippingText(remaining)}
      </p>
      <div
        className="koszyk-dostawa__pasek"
        role="progressbar"
        aria-label="Postęp do darmowej dostawy"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
      >
        <div className="koszyk-dostawa__wypelnienie" style={{ ["--postep" as string]: ratio }} />
      </div>
    </div>
  );
}

export function EmptyCartMessage({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="koszyk-pusty">
      <p className="koszyk-pusty__tekst">{EMPTY_CART_TEXT}</p>
      <div className="koszyk-pusty__akcje">
        <a href="/zbuduj-set" className="tk-btn tk-btn--glowny" onClick={onNavigate}>
          Zbuduj set
        </a>
        <a href="/klawiatury" className="tk-btn tk-btn--poboczny" onClick={onNavigate}>
          Zobacz klawiatury
        </a>
      </div>
    </div>
  );
}

/** Szkielet listy (A-18): pojawia sie dopiero po 300 ms ladowania, rezerwuje miejsce (bez skoku ukladu). */
export function CartSkeleton() {
  return (
    <div className="koszyk-szkielet" aria-hidden="true" data-testid="koszyk-szkielet">
      <span className="koszyk-szkielet__wiersz" />
      <span className="koszyk-szkielet__wiersz" />
      <span className="koszyk-szkielet__wiersz" />
    </div>
  );
}

/** F-153: pole kodu z podpowiedzia kodow demo (etykieta nad polem, docs/11 pulapka 19). */
export function CouponForm({
  code,
  quote,
  codes,
  onApply,
}: {
  code: string | null;
  quote: Quote | null;
  codes: CartSettings["codes"];
  onApply: (code: string | null) => void;
}) {
  const [value, setValue] = useState("");
  const message = code
    ? couponText(quote?.coupon ?? null, quote?.summary.coupon_discount_gr ?? 0)
    : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onApply(v);
    setValue("");
  };
  return (
    <form className="koszyk-kod" onSubmit={submit} noValidate>
      <Field
        label="Kod rabatowy"
        hint={`Kody demo: ${codes.map((c) => c.code).join(", ")}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={32}
        wrapperClassName="koszyk-kod__pole"
      />
      <Button type="submit" variant="secondary" className="koszyk-kod__przycisk">
        Zastosuj kod
      </Button>
      {code ? (
        <div className="koszyk-kod__stan" role="status">
          {message ? (
            <Alert
              variant={
                message.tone === "blad" ? "blad" : message.tone === "uwaga" ? "uwaga" : "sukces"
              }
            >
              {message.text}
            </Alert>
          ) : null}
          <button type="button" className="tk-link tk-link--przycisk" onClick={() => onApply(null)}>
            Usuń kod {code}
          </button>
        </div>
      ) : null}
    </form>
  );
}

/** F-155: podsumowanie ze strony koszyka (ceny brutto, VAT dopiero w kasie). */
export function SummaryRows({ quote, shippingFromGr }: { quote: Quote; shippingFromGr: number }) {
  const s = quote.summary;
  const free = s.free_shipping_remaining_gr === 0;
  return (
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
        <dt>Dostawa</dt>
        <dd>{free ? "Darmowa" : `od ${formatPLN(shippingFromGr)}`}</dd>
      </div>
      <div className="koszyk-sumy__razem">
        <dt>Razem</dt>
        <dd data-testid="koszyk-razem">{formatPLN(quoteValueGr(quote))}</dd>
      </div>
    </dl>
  );
}
