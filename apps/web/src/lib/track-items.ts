// F-242 (docs/10 §3): czyste buildery `items[]`. Kwoty wejsciowe w groszach (calkowite), wyjsciowe w zlotych jako
// liczby; rabat setu na sztuke z rozbicia `allocateDiscount` z @taktyl/domain (docs/03 §6; suma = rabat setu).
import { allocateDiscount } from "@taktyl/domain";
import type { TrackItem } from "./track-events";

/** Zlote jako liczba z groszy (calkowitych): 74990 -> 749.9. Dzielenie calkowitej przez 100 jest dokladne do double. */
export function grToZl(gr: number): number {
  if (!Number.isSafeInteger(gr)) {
    throw new RangeError(`Kwota musi byc calkowita liczba groszy: ${gr}`);
  }
  return gr / 100;
}

export interface TrackLineSource {
  sku: string;
  name: string;
  /** Id kategorii: klawiatury / myszki / podkladki. */
  category: string;
  /** "Grafit / Prog", rozmiar itp. */
  variant?: string;
  /** Cena jednostkowa przed rabatem setu (grosze). */
  priceGr: number;
  quantity?: number;
  /** Gdzie zobaczono: kategoria, kreator-setu, dokoncz-set, polecane, wyszukiwarka. */
  listId?: string;
  listName?: string;
  index?: number;
}

/** Pozycja poza setem: discount 0, bez promotion_name. */
export function buildItem(
  src: TrackLineSource,
  discountPerUnitGr = 0,
  promotionName?: string,
): TrackItem {
  const item: TrackItem = {
    item_id: src.sku,
    item_name: src.name,
    item_brand: "Taktyl",
    item_category: src.category,
    price: grToZl(src.priceGr),
    quantity: src.quantity ?? 1,
    discount: grToZl(discountPerUnitGr),
  };
  if (src.variant) item.item_variant = src.variant;
  if (promotionName) item.promotion_name = promotionName;
  if (src.listId) item.item_list_id = src.listId;
  if (src.listName) item.item_list_name = src.listName;
  if (src.index !== undefined) item.index = src.index;
  return item;
}

/**
 * Pozycje setu: rabat setu (grosze) rozbity na pozycje (po jednej sztuce, reszta na ostatnia),
 * `promotion_name` np. "Rabat za set 10%".
 */
export function buildSetItems(
  lines: readonly TrackLineSource[],
  setDiscountGr: number,
  promotionName: string,
): TrackItem[] {
  const shares = allocateDiscount(
    lines.map((l) => l.priceGr),
    setDiscountGr,
  );
  return lines.map((l, i) => buildItem({ ...l, quantity: 1 }, shares[i] ?? 0, promotionName));
}

/** Wartosc pozycji po rabatach w zlotych (liczona w groszach, bez bledu zmiennoprzecinkowego). */
export function itemsValue(items: readonly TrackItem[]): number {
  const gr = items.reduce(
    (sum, i) => sum + (Math.round(i.price * 100) - Math.round(i.discount * 100)) * i.quantity,
    0,
  );
  return grToZl(gr);
}

/** Suma rabatu w zlotych (do zestawienia z rabatem z podsumowania). */
export function itemsDiscount(items: readonly TrackItem[]): number {
  return grToZl(items.reduce((sum, i) => sum + Math.round(i.discount * 100) * i.quantity, 0));
}

/** `tax` w purchase: VAT zawarty w cenie, value * 23 / 123 (docs/10 §4); grosze, zaokraglenie do grosza. */
export function vatIncludedGr(valueGr: number): number {
  return Math.round((valueGr * 23) / 123);
}
