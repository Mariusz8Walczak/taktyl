// F-131: wiersze tabeli porownania. Etykiety w kolejnosci pierwszego wystapienia; brak wartosci = "—".
// `differs`: wartosci w wierszu nie sa identyczne (przelacznik "Pokaz tylko roznice").
import type { LiteProduct } from "./lite";

export interface CompareRow {
  label: string;
  values: string[];
  differs: boolean;
}

export const NO_VALUE = "—";

export function buildCompareRows(products: readonly LiteProduct[]): CompareRow[] {
  const labels: string[] = [];
  for (const p of products) {
    for (const r of p.rows) if (!labels.includes(r.label)) labels.push(r.label);
  }
  return labels.map((label) => {
    const values = products.map((p) => p.rows.find((r) => r.label === label)?.value ?? NO_VALUE);
    return { label, values, differs: new Set(values).size > 1 };
  });
}
