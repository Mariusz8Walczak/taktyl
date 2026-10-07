"use client";
// F-002, A-03, wzorzec: ikona koszyka z licznikiem (naglowek home-setup-gear.html), tu jako tekst "Koszyk" (docs/09 §2:
// font ikon szablonu nie jest w repo -> sam tekst). Licznik liczy sztuki (set = 1), czyta z modulu koszyka.
import { useEffect, useState } from "react";
import { PRODUCT_FORMS, formatCount } from "@taktyl/domain";
import {
  CART_CHANGED_EVENT,
  CART_STORAGE_KEY,
  parseCartCount,
  useCartCount,
} from "../../lib/cart/count";
import { CART_LINK } from "../../lib/nav";
import { readItem } from "../../lib/storage/safe-storage";
import { NavLink } from "./nav-link";
import "../../styles/animacje.css";

const MAX_SHOWN = 99;

/**
 * A-03: licznik podskakuje tylko przy DODANIU w tej karcie (zdarzenie zmiany koszyka i wiekszy licznik), nigdy przy
 * wczytaniu strony ani przy usuwaniu. Kolejne dodania zmieniaja klucz, wiec animacja startuje od nowa.
 */
function useCounterBump(): number {
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const read = () => parseCartCount(readItem("local", CART_STORAGE_KEY));
    let last = read();
    const onChange = () => {
      const now = read();
      if (now > last) setBump((b) => b + 1);
      last = now;
    };
    window.addEventListener(CART_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CART_CHANGED_EVENT, onChange);
  }, []);
  return bump;
}

export function CartLink() {
  const count = useCartCount();
  const bump = useCounterBump();
  return (
    <NavLink href={CART_LINK.href} className="naglowek__link naglowek__koszyk">
      <span>{CART_LINK.label}</span>
      {count > 0 ? (
        <>
          <span
            key={bump}
            className={bump > 0 ? "licznik is-skok" : "licznik"}
            aria-hidden="true"
            data-testid="licznik-koszyka"
          >
            {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
          </span>
          <span className="tk-sr-only">{`, ${formatCount(count, PRODUCT_FORMS)}`}</span>
        </>
      ) : null}
    </NavLink>
  );
}
