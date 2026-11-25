"use client";
// F-069, F-156 (docs/05 §6 pkt 6; wzorzec: `product-frequently-bought-together`, docs/08 §6): "Dokoncz set" pod lista
// koszyka, gdy sa w nim 1-2 kategorie bez grupy setu. Audyt P1-3: propozycja liczy BRAKUJACE kategorie - pozycje, ktore
// juz sa w koszyku, wchodza do setu, a dokladamy tylko brakujace ("Dodaj podkładkę Len za 59,00 zł, a rabat 10% obejmie
// cały set: −xx zł"). Dobor brakujacych z `GET /v1/products/{slug}/complete-set` (przez `/api/cart/complete-set`, profil
// z kreatora), rabat z @taktyl/domain (setDiscountAmount, allocateDiscount); ceny pozycji z koszyka z wyceny API.
import { allocateDiscount, formatPLN, setDiscountAmount } from "@taktyl/domain";
import type { CompleteSetResponse } from "@taktyl/contracts";
import { Button } from "@taktyl/ui";
import { useEffect, useState } from "react";
import { CATEGORY_SLOT, SLOT_LABEL } from "../../lib/builder/types";
import { builderHref, formatDiscount } from "../../lib/cart/messages";
import { cartStore } from "../../lib/cart/store";
import { trackAddSet } from "../../lib/cart/tracking";
import { categoryOfSku, type CartState, type CategoryId, type Quote } from "../../lib/cart/types";

const ORDER: readonly CategoryId[] = ["klawiatury", "myszki", "podkladki"];

interface Present {
  sku: string;
  name: string;
  priceGr: number;
}

/** Pierwsza dostepna pozycja kazdej kategorii z koszyka (bez setow); null, gdy propozycja nie ma sensu. */
export function presentByCategory(
  cart: CartState,
  quote: Quote | null,
): Map<CategoryId, Present> | null {
  if (!quote || cart.lines.some((l) => l.type === "set")) return null;
  const out = new Map<CategoryId, Present>();
  for (const l of cart.lines) {
    if (l.type !== "item") continue;
    const c = categoryOfSku(l.sku);
    if (out.has(c)) continue;
    const q = quote.lines.find((x) => x.type === "item" && x.sku === l.sku);
    if (q && q.type === "item" && q.available) out.set(c, { sku: l.sku, name: q.name, priceGr: q.price_gr });
  }
  return out.size >= 1 && out.size <= 2 ? out : null;
}

/** Pozycja, od ktorej wychodzi propozycja: klawiatura (regula szerokosci maty jej potrzebuje), potem myszka. */
export function completeSetSeed(
  cart: CartState,
  quote: Quote | null,
): { sku: string; name: string } | null {
  const present = presentByCategory(cart, quote);
  if (!present) return null;
  const first = ORDER.map((c) => present.get(c)).find(Boolean);
  return first ? { sku: first.sku, name: first.name } : null;
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
  const present = presentByCategory(cart, quote);
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

  if (!seed || !data || !present) return null;

  // Set = pozycje z koszyka + brakujace kategorie z propozycji API (kolejnosc: klawiatura, myszka, podkladka)
  const set = ORDER.flatMap((c) => {
    const own = present.get(c);
    if (own) return [{ ...own, inCart: true }];
    const it = data.items.find((i) => categoryOfSku(i.sku) === c);
    return it ? [{ sku: it.sku, name: it.name, priceGr: it.price_gr, inCart: false }] : [];
  });
  if (set.length !== 3) return null;
  const missing = set.filter((i) => !i.inCart);
  const sumGr = set.reduce((s, i) => s + i.priceGr, 0);
  const discountGr = setDiscountAmount(sumGr, percent);
  const skus = set.map((i) => i.sku);
  const addText = missing
    .map((i) => `${SLOT_LABEL[CATEGORY_SLOT[categoryOfSku(i.sku)]].acc} ${i.name} za ${formatPLN(i.priceGr)}`)
    .join(" i ");

  const add = () => {
    const res = cartStore.addSet({ skus, profile: data.profile });
    if (!res) return;
    // pozycje z koszyka wchodza do setu: po jednej sztuce schodzi z koszyka, zeby nie liczyc ich dwa razy
    for (const own of set.filter((i) => i.inCart)) {
      const base = cart.lines.find((l) => l.type === "item" && l.sku === own.sku);
      if (!base || base.type !== "item") continue;
      if (base.qty > 1) cartStore.setQty(base.sku, base.qty - 1);
      else cartStore.remove(base.sku);
    }
    trackAddSet(
      set.map((i) => ({ sku: i.sku, name: i.name, priceGr: i.priceGr })),
      allocateDiscount(
        set.map((i) => i.priceGr),
        discountGr,
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
        Dodaj {addText}, a rabat {percent}% obejmie cały set: {formatDiscount(discountGr)}.
      </p>
      <ul className="lista koszyk-dokoncz__lista">
        {set.map((i) => (
          <li key={i.sku}>
            <span className="koszyk-poz__nazwa">{i.name}</span>
            <span className="koszyk-dokoncz__stan">{i.inCart ? "w koszyku" : "dodamy"}</span>
            <span>{formatPLN(i.priceGr)}</span>
          </li>
        ))}
      </ul>
      <p className="koszyk-dokoncz__razem">
        <span>Razem za set</span>
        <strong>{formatPLN(sumGr - discountGr)}</strong>
      </p>
      <div className="koszyk-dokoncz__akcje">
        <Button onClick={add}>
          {missing.length === 1
            ? `Dodaj ${SLOT_LABEL[CATEGORY_SLOT[categoryOfSku(missing[0]!.sku)]].acc} i utwórz set`
            : "Dodaj set do koszyka"}
        </Button>
        <a href={builderHref({ skus, profile: data.profile })} className="tk-btn tk-btn--poboczny">
          Otwórz w kreatorze
        </a>
      </div>
    </section>
  );
}
