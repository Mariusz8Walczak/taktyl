// F-025: liczebniki przez Intl.PluralRules('pl') (regula 7, pulapka 7). Zero recznych regul koncowek.

export interface PluralForms {
  /** 1 */
  one: string;
  /** 2-4, 22-24, ... */
  few: string;
  /** 0, 5-21, 25-31, ... */
  many: string;
  /** Liczby ulamkowe; domyslnie forma `many`. */
  other?: string;
}

const rules = new Intl.PluralRules("pl");

export const PRODUCT_FORMS: PluralForms = { one: "produkt", few: "produkty", many: "produktów" };

/** Wybiera forme slowa dla liczby n. */
export function pluralize(n: number, forms: PluralForms): string {
  switch (rules.select(n)) {
    case "one":
      return forms.one;
    case "few":
      return forms.few;
    case "many":
      return forms.many;
    default:
      return forms.other ?? forms.many;
  }
}

/** "12 produktów" - liczba w formacie polskim + odmienione slowo. */
export function formatCount(n: number, forms: PluralForms): string {
  return `${n.toLocaleString("pl-PL")} ${pluralize(n, forms)}`;
}
