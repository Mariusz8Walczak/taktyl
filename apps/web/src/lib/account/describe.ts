// F-203, F-201: SKU zapisanego setu -> nazwa, wariant i biezaca cena z katalogu (API). Zapisany set nie przechowuje cen.
import type { LiteProduct, LiteVariant } from "../compare/lite";
import type { SavedSet } from "./sets";

export interface SetLine {
  slot: "k" | "m" | "p";
  sku: string;
  product: LiteProduct | null;
  variant: LiteVariant | null;
}

export const SLOT_NAME: Record<SetLine["slot"], string> = {
  k: "Klawiatura",
  m: "Myszka",
  p: "Podkładka",
};

export function describeSet(set: SavedSet, catalog: readonly LiteProduct[]): SetLine[] {
  const lines: SetLine[] = [];
  for (const slot of ["k", "m", "p"] as const) {
    const sku = set[slot];
    if (!sku) continue;
    let product: LiteProduct | null = null;
    let variant: LiteVariant | null = null;
    for (const p of catalog) {
      const v = p.variants.find((x) => x.sku === sku);
      if (v) {
        product = p;
        variant = v;
        break;
      }
    }
    lines.push({ slot, sku, product, variant });
  }
  return lines;
}

/** Suma biezacych cen pozycji znalezionych w katalogu (grosze, bez rabatu za set); null, gdy nic nie znaleziono. */
export function sumLines(lines: readonly SetLine[]): number | null {
  const found = lines.flatMap((l) => (l.variant ? [l.variant.priceGr] : []));
  return found.length === 0 ? null : found.reduce((a, b) => a + b, 0);
}
