"use client";
// F-068 (wzorzec: przyklejony pasek zakupu z `product-detail`, docs/08 §3): na telefonie po przewinieciu poza
// przycisk glowny - cena, wariant i "Dodaj do koszyka". Nie zaslania fokusu ani stopki (docs/11 pulapka 26):
// dopoki pasek jest widoczny, <html> dostaje klase `ma-pasek-zakupu` (padding-bottom body = wysokosc paska
// i scroll-padding-bottom), wiec stopka da sie przewinac w calosci, a element z fokusem nie chowa sie pod paskiem.
import { formatPLN } from "@taktyl/domain";
import { Button } from "@taktyl/ui";
import { useEffect, useState } from "react";
import { stockView } from "../../lib/catalog/price";
import { isBuyable } from "../../lib/catalog/variants";
import { BUY_BUTTON_ID } from "./buy-column";
import { useProduct } from "./product-context";

const HTML_CLASS = "ma-pasek-zakupu";

export function StickyBar() {
  const { variant, variantLabel, add, busy } = useProduct();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(BUY_BUTTON_ID);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      // widoczny dopiero PO przewinieciu przycisku w gore (nie zanim do niego dojedziemy)
      setVisible(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < 0));
    });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(HTML_CLASS, visible);
    return () => document.documentElement.classList.remove(HTML_CLASS);
  }, [visible]);

  const buyable = isBuyable(variant);
  const stock = stockView(variant.stock, variant.status === "active");

  return (
    <div className="pasek-zakupu" hidden={!visible} role="region" aria-label="Szybki zakup">
      <div className="pasek-zakupu__opis">
        <p className="pasek-zakupu__cena">{formatPLN(variant.price_gr)}</p>
        <p className="pasek-zakupu__wariant">
          {buyable ? variantLabel : `${variantLabel}: ${stock.label}`}
        </p>
      </div>
      <Button
        className="pasek-zakupu__przycisk"
        disabled={!buyable}
        loading={busy}
        onClick={() => void add()}
      >
        Dodaj do koszyka
      </Button>
    </div>
  );
}
