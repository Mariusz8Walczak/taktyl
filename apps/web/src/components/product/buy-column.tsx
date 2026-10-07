"use client";
// F-044, F-062...F-067 (docs/05 §4 pkt 2-10; wzorzec: kolumna zakupu `product-detail`, docs/08 §3): plakietki, H1,
// `short`, blok ceny z Omnibusem, wybor wariantu, dostepnosc i termin wysylki, ilosc + "Dodaj do koszyka" (glowny)
// + "Dodaj do setu" (poboczny), pasek warunkow. Ulubione i porownaj (F-045, TAKTYL-55) to ProductTools.
// Cena i stan pochodza z wybranego wariantu (API); przekreslona jest `lowest_30d`, nie regular_price (docs/04 §5.2).
import { formatPLN } from "@taktyl/domain";
import { Badge, Button, Quantity } from "@taktyl/ui";
import type { ReactNode } from "react";
import type { DispatchTexts } from "../../lib/catalog/dispatch";
import {
  omnibusSentence,
  priceView,
  promoBadgeText,
  stockView,
  UNAVAILABLE_MESSAGE,
} from "../../lib/catalog/price";
import { ProductTools } from "../compare/product-tools";
import { isBuyable } from "../../lib/catalog/variants";
import { useRecentlyAdded } from "../../lib/cart/ui";
import { useProduct } from "./product-context";
import { VariantPicker } from "./variant-picker";

/** Id przycisku glownego: pasek zakupu na telefonie sledzi jego widocznosc (F-068). */
export const BUY_BUTTON_ID = "przycisk-zakupu";
const SET_PARAM: Record<string, string> = { klawiatury: "k", myszki: "m", podkladki: "p" };

export function BuyColumn({
  conditions,
  dispatch,
}: {
  /** Pasek warunkow (F-067), komponent serwerowy. */
  conditions: ReactNode;
  dispatch: DispatchTexts | null;
}) {
  const { product, variant, qty, setQty, add, busy } = useProduct();
  // A-03: etykieta "Dodano" przez 1,2 s po dodaniu (stan z modulu koszyka, sygnatura adaptera bez zmian)
  const justAdded = useRecentlyAdded();
  const price = priceView(variant);
  const stock = stockView(variant.stock, variant.status === "active");
  const buyable = isBuyable(variant);
  const maxQty = Math.max(1, stock.maxQty);
  const qtyShown = Math.min(qty, maxQty);

  const badges: {
    variant: "nowosc" | "bestseller" | "promocja" | "ostatnie-sztuki" | "brak";
    text?: string;
  }[] = [];
  if (price.percent !== null)
    badges.push({ variant: "promocja", text: promoBadgeText(price.percent) });
  for (const b of product.badges) badges.push({ variant: b });
  if (stock.level === "ostatnie") badges.push({ variant: "ostatnie-sztuki" });
  if (stock.level === "brak") badges.push({ variant: "brak" });

  const setHref = `/zbuduj-set?${SET_PARAM[product.category] ?? "k"}=${variant.sku}`;

  return (
    <div className="zakup">
      {badges.length > 0 ? (
        <ul className="lista zakup__plakietki" aria-label="Oznaczenia">
          {badges.map((b) => (
            <li key={b.variant}>
              <Badge variant={b.variant}>{b.text}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <h1 className="zakup__nazwa">{product.name}</h1>
      <p className="zakup__opis">{product.short}</p>

      <div className="cena">
        <p className="cena__glowna">
          <span
            className={
              price.omnibusGr !== null ? "cena__kwota cena__kwota--promocja" : "cena__kwota"
            }
          >
            {formatPLN(price.priceGr)}
          </span>
          {price.omnibusGr !== null ? (
            <>
              {" "}
              <del className="cena__przekreslona">{formatPLN(price.omnibusGr)}</del>
            </>
          ) : null}
        </p>
        {price.omnibusGr !== null ? (
          <p className="cena__omnibus">{omnibusSentence(price.omnibusGr)}</p>
        ) : null}
      </div>

      <VariantPicker />

      <div className="dostepnosc" aria-live="polite">
        <p className={`dostepnosc__stan dostepnosc__stan--${stock.level}`}>{stock.label}</p>
        {!buyable ? <p className="dostepnosc__brak">{UNAVAILABLE_MESSAGE}</p> : null}
        {buyable && dispatch ? (
          <p className="dostepnosc__termin">
            <strong>{dispatch.headline}</strong>
            <br />
            {dispatch.message}
          </p>
        ) : null}
      </div>

      <div className="zakup__akcje">
        <Quantity
          label={`Ilość: ${product.name}`}
          value={qtyShown}
          min={1}
          max={maxQty}
          onChange={setQty}
          className={buyable ? undefined : "is-nieaktywna"}
        />
        <Button
          id={BUY_BUTTON_ID}
          className="zakup__koszyk"
          disabled={!buyable}
          loading={busy}
          aria-describedby={buyable ? undefined : "powod-braku"}
          onClick={() => void add()}
        >
          {justAdded ? "Dodano" : "Dodaj do koszyka"}
        </Button>
        <a href={setHref} className="tk-btn tk-btn--poboczny zakup__set">
          Dodaj do setu
        </a>
      </div>
      {!buyable ? (
        <p id="powod-braku" className="zakup__powod">
          Tego wariantu nie można teraz dodać do koszyka. Wybierz inny kolor, przełącznik lub
          rozmiar.
        </p>
      ) : null}

      {/* F-045: ulubione i porownaj (TAKTYL-55) */}
      <ProductTools />

      {conditions}
    </div>
  );
}
