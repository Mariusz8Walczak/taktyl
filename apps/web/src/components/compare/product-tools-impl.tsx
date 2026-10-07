"use client";
// F-045, F-130, F-132: wlasciwe przyciski karty produktu (doladowywane przez `product-tools.tsx`).
import { useProduct } from "../product/product-context";
import { FavoriteButton } from "../wishlist/favorite-button";
import { CompareButton } from "./compare-button";

export default function ProductToolsImpl() {
  const { product, variant, variantLabel } = useProduct();
  return (
    <>
      <FavoriteButton
        sku={variant.sku}
        productSkus={product.variants.map((v) => v.sku)}
        name={product.name}
        category={product.category}
        priceGr={variant.price_gr}
        variantLabel={variantLabel}
      />
      <CompareButton id={product.id} category={product.category} name={product.name} />
    </>
  );
}
