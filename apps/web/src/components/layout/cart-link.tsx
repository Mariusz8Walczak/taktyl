"use client";
// F-002, wzorzec: ikona koszyka z licznikiem (naglowek home-setup-gear.html), tu jako tekst "Koszyk" (docs/09 §2:
// font ikon szablonu nie jest w repo -> sam tekst). Licznik liczy sztuki (set = 1), czyta z modulu koszyka.
import { PRODUCT_FORMS, formatCount } from "@taktyl/domain";
import { useCartCount } from "../../lib/cart/count";
import { CART_LINK } from "../../lib/nav";
import { NavLink } from "./nav-link";

const MAX_SHOWN = 99;

export function CartLink() {
  const count = useCartCount();
  return (
    <NavLink href={CART_LINK.href} className="naglowek__link naglowek__koszyk">
      <span>{CART_LINK.label}</span>
      {count > 0 ? (
        <>
          <span className="licznik" aria-hidden="true" data-testid="licznik-koszyka">
            {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
          </span>
          <span className="tk-sr-only">{`, ${formatCount(count, PRODUCT_FORMS)}`}</span>
        </>
      ) : null}
    </NavLink>
  );
}
