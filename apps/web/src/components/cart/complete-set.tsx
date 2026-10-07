"use client";
// F-069, F-156 (docs/05 §6 pkt 6; wzorzec: `product-frequently-bought-together`, docs/08 §6): "Dokoncz set" pod lista
// koszyka, gdy sa w nim 1-2 kategorie bez grupy setu. Prosty komponent oparty o `GET /v1/products/{slug}/complete-set`
// (przez `/api/cart/complete-set`): propozycja trzech pozycji z cena po rabacie, "Dodaj set do koszyka" i link do kreatora.
import { allocateDiscount, formatPLN } from "@taktyl/domain";
import type { CompleteSetResponse } from "@taktyl/contracts";
import { Button } from "@taktyl/ui";
import { useEffect, useState } from "react";
import { builderHref, formatDiscount } from "../../lib/cart/messages";
import { cartStore } from "../../lib/cart/store";
import { trackAddSet } from "../../lib/cart/tracking";
import { categoryOfSku, type CartState, type Quote } from "../../lib/cart/types";

/** Pozycja, od ktorej wychodzi propozycja: pierwsza pozycja poza setem z wyceny. */
export function completeSetSeed(
  cart: CartState,
  quote: Quote | null,
): { sku: string; name: string } | null {
  if (!quote || cart.lines.some((l) => l.type === "set")) return null;
  const items = cart.lines.flatMap((l) => (l.type === "item" ? [l] : []));
  const categories = new Set(items.map((l) => categoryOfSku(l.sku)));
  if (categories.size < 1 || categories.size > 2) return null;
  for (const l of items) {
    const q = quote.lines.find((x) => x.type === "item" && x.sku === l.sku);
    if (q && q.type === "item" && q.available) return { sku: l.sku, name: q.name };
  }
  return null;
}

export function CompleteSet({
  cart,
  quote,
  percent,
}: {
  cart: CartState;
  quote: Quote | null;
  /** Procent rabatu setu z ustawien sklepu. */
  percent: number;
}) {
  const seed = completeSetSeed(cart, quote);
  const seedSku = seed?.sku ?? null;
  const seedName = seed?.name ?? null;
  const [data, setData] = useState<CompleteSetResponse | null>(null);

  useEffect(() => {
    if (!seedSku || !seedName) {
      setData(null);
      return undefined;
    }
    const ctrl = new AbortController();
    fetch(
      `/api/cart/complete-set?sku=${encodeURIComponent(seedSku)}&name=${encodeURIComponent(seedName)}`,
      {
        signal: ctrl.signal,
        cache: "no-store",
      },
    )
      .then((r) => (r.ok ? (r.json() as Promise<CompleteSetResponse>) : null))
      .then((d) => setData(d && Array.isArray(d.items) && d.items.length === 3 ? d : null))
      .catch(() => setData(null));
    return () => ctrl.abort();
  }, [seedSku, seedName]);

  if (!seed || !data) return null;
  const skus = data.items.map((i) => i.sku);

  const add = () => {
    const res = cartStore.addSet({ skus, profile: data.profile });
    if (!res) return;
    // pozycja wyjsciowa wchodzi do setu: jedna sztuka schodzi z koszyka, zeby nie liczyc jej dwa razy
    const base = cart.lines.find((l) => l.type === "item" && l.sku === seed.sku);
    if (base && base.type === "item") {
      if (base.qty > 1) cartStore.setQty(base.sku, base.qty - 1);
      else cartStore.remove(base.sku);
    }
    trackAddSet(
      data.items.map((i) => ({ sku: i.sku, name: i.name, priceGr: i.price_gr })),
      allocateDiscount(
        data.items.map((i) => i.price_gr),
        data.set_discount_gr,
      ),
      percent,
    );
  };

  return (
    <section className="koszyk-dokoncz" aria-labelledby="dokoncz-set-naglowek">
      <h2 id="dokoncz-set-naglowek" className="koszyk-dokoncz__naglowek">
        Dokończ set
      </h2>
      <p className="koszyk-dokoncz__opis">
        Z trzema kategoriami rabat {percent}% obejmuje cały set (
        {formatDiscount(data.set_discount_gr)}).
      </p>
      <ul className="lista koszyk-dokoncz__lista">
        {data.items.map((i) => (
          <li key={i.sku}>
            <span className="koszyk-poz__nazwa">{i.name}</span>
            <span>{formatPLN(i.price_gr)}</span>
          </li>
        ))}
      </ul>
      <p className="koszyk-dokoncz__razem">
        <span>Razem</span>
        <strong>{formatPLN(data.total_gr)}</strong>
      </p>
      <div className="koszyk-dokoncz__akcje">
        <Button onClick={add}>Dodaj set do koszyka</Button>
        <a href={builderHref({ skus, profile: data.profile })} className="tk-btn tk-btn--poboczny">
          Otwórz w kreatorze
        </a>
      </div>
    </section>
  );
}
