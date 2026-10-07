// F-062, F-063 (docs/02 §5): logika wyboru wariantu - kolor, przelacznik, rozmiar podkladki. Czysta, bez DOM.
// Wariant niedostepny jest WIDOCZNY i oznaczony "Brak"; jego wybor nie pozwala kupic (przycisk nieaktywny
// z wyjasnieniem). Wartosc, ktorej nie ma w zadnym kupowalnym wariancie, jest dodatkowo nieaktywna (radio disabled).
import type { Variant } from "@taktyl/contracts";

export type Dim = "color" | "switch" | "size";
export interface Selection {
  color: string;
  switch: string | null;
  size: string | null;
}

export const selectionOf = (v: Variant): Selection => ({
  color: v.color,
  switch: v.switch,
  size: v.size,
});

export const isBuyable = (v: Variant | undefined): v is Variant =>
  v !== undefined && v.status === "active" && v.stock > 0;

function dimValue(v: Variant, dim: Dim): string | null {
  return dim === "color" ? v.color : dim === "switch" ? v.switch : v.size;
}

/** Unikalne wartosci wymiaru w kolejnosci wariantow (kolejnosc SKU z API). */
export function dimValues(variants: readonly Variant[], dim: Dim): string[] {
  const out: string[] = [];
  for (const v of variants) {
    const val = dimValue(v, dim);
    if (val !== null && !out.includes(val)) out.push(val);
  }
  return out;
}

export function findVariant(variants: readonly Variant[], sel: Selection): Variant | undefined {
  return variants.find(
    (v) => v.color === sel.color && v.switch === sel.switch && v.size === sel.size,
  );
}

/**
 * Wariant po zmianie jednego wymiaru: dokladne trafienie, a gdy kombinacji nie ma - najblizszy wariant z ta wartoscia
 * (najwiecej zgodnych pozostalych wymiarow, potem kupowalny, potem najtanszy, potem SKU).
 */
export function resolveVariant(
  variants: readonly Variant[],
  current: Selection,
  dim: Dim,
  value: string,
): Variant | undefined {
  const next: Selection = { ...current, [dim]: value };
  const exact = findVariant(variants, next);
  if (exact) return exact;
  const dims: Dim[] = ["color", "switch", "size"];
  const score = (v: Variant) => dims.filter((d) => d !== dim && dimValue(v, d) === next[d]).length;
  return variants
    .filter((v) => dimValue(v, dim) === value)
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        Number(isBuyable(b)) - Number(isBuyable(a)) ||
        a.price_gr - b.price_gr ||
        a.sku.localeCompare(b.sku),
    )[0];
}

export type OptionStatus = "ok" | "brak" | "niedostepny";

/**
 * Stan wartosci w grupie: `niedostepny` - zadnego kupowalnego wariantu z ta wartoscia (nieaktywna);
 * `brak` - przy obecnych pozostalych wyborach wariantu nie ma na stanie (widoczna, wybieralna, z opisem);
 * `ok` - mozna kupic.
 */
export function optionStatus(
  variants: readonly Variant[],
  current: Selection,
  dim: Dim,
  value: string,
): OptionStatus {
  if (!variants.some((v) => dimValue(v, dim) === value && isBuyable(v))) return "niedostepny";
  const hit = findVariant(variants, { ...current, [dim]: value });
  return isBuyable(hit) ? "ok" : "brak";
}

/** Adres kanoniczny bez parametru: `?sku=` tylko dla wariantu innego niz domyslny. */
export function skuParam(variantSku: string, defaultSku: string): string | null {
  return variantSku === defaultSku ? null : variantSku;
}
