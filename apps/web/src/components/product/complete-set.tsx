// F-069 (docs/05 §4 pkt 12; wzorzec: `product-frequently-bought-together`, docs/08 §3): blok "Dokoncz set" na karcie
// produktu. Komponent serwerowy pyta `GET /v1/products/{slug}/complete-set?sku=` (znaczniki product:{slug}, catalog,
// shop-settings) i renderuje statyczny widok; interaktywna wersja laduje sie leniwie (`complete-set-lazy.tsx`).
// Gdy API nie zwroci kompletu, blok jest ukryty.
import type { Product, PublicShopSettings } from "@taktyl/contracts";
import "../../styles/dokoncz-set.css";
import type { ColorInfo, SwitchInfo } from "../../lib/builder/catalog";
import type { CompleteSetProps } from "../../lib/builder/complete-view";
import { loadCompleteSet } from "../../lib/builder/complete";
import { CompleteSetLazy } from "./complete-set-lazy";
import { CompleteSetStatic } from "./complete-set-static";

export async function CompleteSet({
  product,
  sku,
  colors,
  switches,
  settings,
}: {
  product: Product;
  /** SKU wariantu startowego karty (kotwica doboru). */
  sku: string;
  colors: ColorInfo[];
  switches: SwitchInfo[];
  settings: Pick<PublicShopSettings, "set_discount">;
}) {
  const data = await loadCompleteSet(product, sku);
  if (!data) return null;
  const props: CompleteSetProps = {
    profile: data.profile,
    skus: data.skus,
    products: data.products,
    anchor: data.anchor,
    colors,
    switches,
    rules: data.rules,
    setDiscount: {
      percent: settings.set_discount.percent,
      categories: settings.set_discount.categories,
    },
  };
  return (
    <CompleteSetLazy props={props}>
      <CompleteSetStatic {...props} />
    </CompleteSetLazy>
  );
}
