"use client";
// F-070 (docs/04 §4): wartosc wiersza specyfikacji zaleznego od wybranego wariantu ("Przelacznik", "Rozmiar",
// "Przeznaczenie"). Reszta tabeli jest serwerowa; ten wiersz reaguje na wybor wariantu.
import { variantSpecRows } from "../../lib/catalog/attributes";
import { useProduct } from "./product-context";

export function VariantSpecValue({ label }: { label: string }) {
  const { product, variant, switches } = useProduct();
  const rows = variantSpecRows(
    { category: product.category, ...(product.padSizes ? { sizes: product.padSizes } : {}) },
    variant,
    switches,
  );
  return <>{rows.find((r) => r.label === label)?.value ?? "—"}</>;
}
