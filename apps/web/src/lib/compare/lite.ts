// F-131, F-132 (docs/04 §4): lekki model produktu dla porownywarki i ulubionych. Czysta funkcja: pelny produkt z API
// -> dane do wyslania do wyspy klienckiej (etykiety i formaty atrybutow z `specRows`, bez opisow i GPSR).
// Ceny w groszach; zdjecia tylko z manifestu (ImageRef), brak = placeholder w ProductImage.
import type { Product } from "@taktyl/contracts";
import { padSizeDescription, specRows, type Param, type SwitchLike } from "../catalog/attributes";
import { packshotsFor, type ImageRef } from "../catalog/images";
import { isBuyable } from "../catalog/variants";

export interface LiteVariant {
  sku: string;
  /** "Grafit · Próg", "Grafit · XL". */
  label: string;
  colorName: string;
  priceGr: number;
  buyable: boolean;
  image: ImageRef | null;
}

export interface LiteProduct {
  id: string;
  slug: string;
  category: string;
  name: string;
  href: string;
  /** Najnizsza cena sposrod dostepnych wariantow ("od X zl"); gdy nic nie jest dostepne - najnizsza w ogole. */
  fromGr: number;
  buyable: boolean;
  image: ImageRef | null;
  colorName: string;
  rows: Param[];
  variants: LiteVariant[];
}

type ColorLike = { id: string; label: string };
type SwitchName = SwitchLike & { name: string };

export function toLiteProduct(
  p: Product,
  colors: readonly ColorLike[],
  switches: readonly SwitchName[],
): LiteProduct {
  const colorOf = (id: string) => colors.find((c) => c.id === id)?.label ?? id;
  const sizes =
    p.category === "podkladki"
      ? (p.attributes as { sizes: Record<string, { label: string; w: number; d: number }> }).sizes
      : {};

  const variants: LiteVariant[] = p.variants.map((v) => {
    const parts = [colorOf(v.color)];
    if (v.switch !== null) parts.push(switches.find((s) => s.id === v.switch)?.name ?? v.switch);
    if (v.size !== null) parts.push(sizes[v.size]?.label ?? v.size);
    return {
      sku: v.sku,
      label: parts.join(" · "),
      colorName: colorOf(v.color),
      priceGr: v.price_gr,
      buyable: isBuyable(v),
      image: packshotsFor(p.images, p.id, v.images_key)[0] ?? null,
    };
  });

  const buyable = variants.filter((v) => v.buyable);
  const pool = buyable.length > 0 ? buyable : variants;
  const fromGr = Math.min(...pool.map((v) => v.priceGr));
  const shown =
    variants.find((v) => v.sku === p.default_variant_sku) ?? (variants[0] as LiteVariant);

  // Wiersze spoza specyfikacji ogolnej: warianty (kolory, przelaczniki, rozmiary) pokazane w tabeli jak w docs/04 §4.
  const rows = specRows(p);
  const colorLabels = [...new Set(p.variants.map((v) => colorOf(v.color)))];
  if (p.category === "klawiatury") {
    const used = new Set<string>(p.variants.flatMap((v) => (v.switch === null ? [] : [v.switch])));
    rows.push({
      label: "Przełączniki",
      value: switches
        .filter((s) => used.has(s.id))
        .map((s) => s.name)
        .join(", "),
    });
  }
  if (p.category === "podkladki") {
    rows.push({
      label: "Rozmiary",
      value: Object.values(sizes)
        .map((s) => `${s.label} (${padSizeDescription(s.w, s.d)})`)
        .join(", "),
    });
  }
  rows.push({ label: "Kolory", value: colorLabels.join(", ") });

  return {
    id: p.id,
    slug: p.slug,
    category: p.category,
    name: p.name,
    href: `/${p.category}/${p.slug}`,
    fromGr,
    buyable: buyable.length > 0,
    image: shown.image,
    colorName: shown.colorName,
    rows: rows.filter((r) => r.value !== ""),
    variants,
  };
}
