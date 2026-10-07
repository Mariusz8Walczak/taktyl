// F-060...F-078 (docs/02 §5): model produktu dla wyspy klienckiej karty i dane strukturalne Product (F-078).
// Do przegladarki trafia tylko to, czego potrzebuje wybor wariantu i galeria (bez GPSR, opisu, in_box).
import type { Product, Variant } from "@taktyl/contracts";
import { absoluteUrl } from "../site";
import type { ImageRef } from "./images";
import type { PadSizeLike } from "./attributes";

export interface ClientProduct {
  id: string;
  slug: string;
  category: Product["category"];
  name: string;
  short: string;
  options: Product["options"];
  defaultSku: string;
  badges: Product["badges"];
  variants: Variant[];
  /** Tylko ujecia produktowe (packshot). */
  images: ImageRef[];
  /** Tylko podkladki: attributes.sizes (kafle rozmiaru, wiersze specyfikacji). */
  padSizes: Record<string, PadSizeLike> | null;
}

export function toClientProduct(p: Product): ClientProduct {
  return {
    id: p.id,
    slug: p.slug,
    category: p.category,
    name: p.name,
    short: p.short,
    options: p.options,
    defaultSku: p.default_variant_sku,
    badges: p.badges,
    variants: p.variants,
    images: p.images.filter((i) => i.kind === "packshot"),
    padSizes:
      p.category === "podkladki" ? (p.attributes.sizes as Record<string, PadSizeLike>) : null,
  };
}

const priceFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

/**
 * F-078 (docs/11 §1.2): dane strukturalne Product z `offers` dla domyslnego wariantu. BEZ aggregateRating i review
 * (opinie sa demonstracyjne). Cena jako tekst z kropka i dwoma miejscami, waluta PLN, dostepnosc wg stanu.
 */
export function productJsonLd(product: Product, variant: Variant): Record<string, unknown> {
  const url = absoluteUrl(`/${product.category}/${product.slug}`);
  const inStock = variant.status === "active" && variant.stock > 0;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.short,
    sku: variant.sku,
    category: product.category,
    brand: { "@type": "Brand", name: product.brand },
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "PLN",
      price: priceFormat.format(variant.price_gr / 100),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
