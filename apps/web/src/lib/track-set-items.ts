// F-242 (docs/10 §3): pozycje setu w items[] - osobny modul, zeby `allocateDiscount` (@taktyl/domain) nie trafial do
// paczek stron, ktore uzywaja tylko `buildItem` (karta produktu, listing; TAKTYL-67).
import { allocateDiscount } from "@taktyl/domain";
import type { TrackItem } from "./track-events";
import { buildItem } from "./track-items";
import type { TrackLineSource } from "./track-items";

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
