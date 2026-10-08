// F-062, F-066 (docs/10 §4): zdarzenia view_item i add_to_cart karty produktu. Osobny modul ladowany dynamicznie przez
// product-context, zeby builder `items[]` (track-items) nie powiekszal paczki karty produktu (TAKTYL-67, docs/12 §4).
import type { Variant } from "@taktyl/contracts";
import type { ClientProduct } from "../../lib/catalog/product-view";
import { buildItem, grToZl } from "../../lib/track-items";
import { track } from "../../lib/track";

interface ViewInput {
  product: ClientProduct;
  variant: Variant;
  variantLabel: string;
}

export function trackViewItem({ product, variant, variantLabel }: ViewInput): void {
  track("view_item", {
    items: [
      buildItem({
        sku: variant.sku,
        name: product.name,
        category: product.category,
        variant: variantLabel,
        priceGr: variant.price_gr,
      }),
    ],
    currency: "PLN",
    value: grToZl(variant.price_gr),
  });
}

export function trackAddToCart(input: ViewInput & { qty: number; categoryName: string }): void {
  const { product, variant, variantLabel, qty, categoryName } = input;
  track("add_to_cart", {
    items: [
      buildItem({
        sku: variant.sku,
        name: product.name,
        category: product.category,
        variant: variantLabel,
        priceGr: variant.price_gr,
        quantity: qty,
        listId: product.category,
        listName: categoryName,
      }),
    ],
    currency: "PLN",
    value: grToZl(variant.price_gr * qty),
  });
}
