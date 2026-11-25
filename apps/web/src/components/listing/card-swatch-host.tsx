"use client";
// F-040 (karta produktu, probki kolorow; uwagi z pokazu, D-2026-11-25): klikniecie probki na karcie pokazuje zdjecie
// tego koloru i przelacza wariant karty (adres odnosnika ?sku= i SKU przycisku "Szybko dodaj"). Karty sa serwerowe
// i nie niosa JS - ten host nasluchuje klikniec (delegacja), jak QuickAddHost. Zdjecie przelacza CSS po atrybucie
// `data-kolor` na karcie (listing.css), ruch A-09 (opacity) bez zmian.
import { useEffect } from "react";

const SELECTOR = "[data-probka-karty]";

function choose(btn: HTMLElement) {
  const card = btn.closest<HTMLElement>(".karta");
  const index = Number(btn.dataset.probkaKarty);
  const sku = btn.dataset.sku;
  if (!card || !Number.isInteger(index) || !sku) return;
  if (index === 0) delete card.dataset.kolor;
  else card.dataset.kolor = String(index);
  for (const b of card.querySelectorAll<HTMLElement>(SELECTOR)) {
    b.setAttribute("aria-pressed", String(b === btn));
  }
  const link = card.querySelector<HTMLAnchorElement>(".karta__link");
  if (link) {
    const url = new URL(link.href, window.location.origin);
    url.searchParams.set("sku", sku);
    link.setAttribute("href", `${url.pathname}${url.search}`);
  }
  const quick = card.querySelector<HTMLElement>("[data-szybko-dodaj]");
  if (quick) quick.dataset.sku = sku;
}

export function CardSwatchHost() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = e.target instanceof Element ? e.target.closest<HTMLElement>(SELECTOR) : null;
      if (!btn) return;
      e.preventDefault();
      choose(btn);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
