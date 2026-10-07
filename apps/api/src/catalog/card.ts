// F-020, F-024, F-064 (B-216): karta produktu na listingu - "od X zl" z najtanszego dostepnego wariantu (docs/04 par. 5.1).
import { listingPrice, type Product, type Variant } from "@taktyl/domain";
import type { ProductCard } from "@taktyl/contracts";

export interface CardInput {
  product: Product;
  /** Warianty pasujace do filtrow wariantowych (wszystkie, gdy brak takich filtrow). */
  variants: readonly Variant[];
  displayVariant: Variant | undefined;
}

export function toCard(item: CardInput, variantFilterActive: boolean): ProductCard {
  const { product } = item;
  const pool = item.variants.length > 0 ? item.variants : product.variants;
  const lp = listingPrice(pool);
  const candidates = pool.filter((v) => (lp?.available ? v.stock > 0 : true));
  const priceVariant = [...candidates].sort((a, b) => a.price - b.price)[0] as Variant;
  return {
    id: product.id,
    slug: product.slug,
    category: product.category,
    name: product.name,
    short: product.short,
    badges: product.badges as ProductCard["badges"],
    from_price_gr: priceVariant.price,
    lowest_30d_gr: priceVariant.lowest30d,
    in_stock: lp?.available ?? false,
    default_variant_sku: product.defaultVariant,
    matched_variant_sku: variantFilterActive ? (item.displayVariant?.sku ?? null) : null,
    color_count: new Set(pool.map((v) => v.color)).size,
  };
}
