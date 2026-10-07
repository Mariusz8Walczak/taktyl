"use client";
// F-045, F-130, F-132: wlasciwe przyciski karty listingu (doladowywane przez `card-actions.tsx`).
import { CompareButton } from "./compare-button";
import { FavoriteButton } from "../wishlist/favorite-button";

export interface CardActionsProps {
  id: string;
  category: string;
  name: string;
  sku: string;
  skus: readonly string[];
  priceGr: number;
  variantLabel?: string;
}

export default function CardActionsImpl({
  id,
  category,
  name,
  sku,
  skus,
  priceGr,
  variantLabel,
}: CardActionsProps) {
  return (
    <>
      <FavoriteButton
        sku={sku}
        productSkus={skus}
        name={name}
        category={category}
        priceGr={priceGr}
        {...(variantLabel ? { variantLabel } : {})}
      />
      <CompareButton id={id} category={category} name={name} />
    </>
  );
}
