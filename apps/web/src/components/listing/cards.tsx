// F-040, F-020 (docs/05 §3): lista kart listingu jako komponent serwerowy. Pobiera pelne produkty (atrybuty, kolory,
// zdjecia) rownolegle z cache danych Next (znacznik `product:{slug}`), sklada widoki i renderuje karty.
// Uzywany przez strone listingu i przez akcje serwerowa "Pokaz wiecej".
import type { ProductCard as ProductCardData } from "@taktyl/contracts";
import type { ReactNode } from "react";
import { getColors, getProduct, getSwitches } from "../../lib/api";
import { buildCardView, cardTrackSource } from "../../lib/catalog/card-view";
import { ProductCard } from "./product-card";

export interface CardsProps {
  cards: readonly ProductCardData[];
  categoryName: string;
  /** Indeks pierwszej karty na liscie (pozycja `index` w zdarzeniach pomiaru). */
  startIndex?: number;
  /** Ile pierwszych kart ma zdjecie z fetchpriority=high. */
  priorityCount?: number;
  /** Wstawka po karcie o tym indeksie na liscie (docs/05 §3 pkt 8: po 6. karcie). */
  insertAfter?: { index: number; node: ReactNode };
}

export async function Cards({
  cards,
  categoryName,
  startIndex = 0,
  priorityCount = 0,
  insertAfter,
}: CardsProps) {
  const [colors, switches, products] = await Promise.all([
    getColors(),
    getSwitches(),
    Promise.all(cards.map((c) => getProduct(c.slug, c.category))),
  ]);
  const ctx = { colors, switches };
  const out: ReactNode[] = [];
  cards.forEach((card, i) => {
    const product = products[i];
    if (!product) return; // produkt zniknal miedzy listingiem a karta (wyscig z backpanelem)
    const view = buildCardView(card, product, ctx);
    const index = startIndex + i;
    out.push(
      <ProductCard
        key={view.id}
        view={view}
        priority={index < priorityCount}
        track={cardTrackSource(view, categoryName, index)}
      />,
    );
    if (insertAfter && insertAfter.index === index) out.push(insertAfter.node);
  });
  return <>{out}</>;
}
