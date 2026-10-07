// F-040, F-041, F-044 (docs/02 §4): model widoku karty produktu na listingu. Czysta funkcja: karta z listingu
// + pelny produkt z API (atrybuty, kolory, zdjecia) -> dane do wyrenderowania. Nic spoza danych API.
import type { Product, ProductCard } from "@taktyl/contracts";
import type { BadgeVariant } from "@taktyl/ui";
import { keyParams, type Param, type SwitchLike } from "./attributes";
import { packshotsFor, secondShotFor, type ImageRef } from "./images";
import { priceView, promoBadgeText, omnibusSentence } from "./price";

export interface CardBadge {
  variant: BadgeVariant;
  text?: string;
}

export interface CardColor {
  id: string;
  label: string;
  swatch: string;
}

export interface CardView {
  id: string;
  slug: string;
  category: string;
  name: string;
  href: string;
  /** Wariant, ktorego zdjecie i adres pokazuje karta (dopasowany do filtrow albo domyslny). */
  sku: string;
  variantLabel: string;
  colorName: string;
  image: ImageRef | null;
  secondImage: ImageRef | null;
  params: Param[];
  priceGr: number;
  omnibusGr: number | null;
  omnibusText: string | null;
  badges: CardBadge[];
  colors: CardColor[];
}

type ColorLike = { id: string; label: string; swatch: string };

export interface CardContext {
  colors: readonly ColorLike[];
  switches: readonly (SwitchLike & { name: string })[];
}

/** Wariant o najnizszej cenie sposrod dostepnych (jak w API: docs/04 §5.1); gdy brak dostepnych - najtanszy. */
function priceVariant(product: Product) {
  const buyable = product.variants.filter((v) => v.status === "active" && v.stock > 0);
  const pool = buyable.length > 0 ? buyable : product.variants;
  return [...pool].sort((a, b) => a.price_gr - b.price_gr || a.sku.localeCompare(b.sku))[0];
}

export function buildCardView(card: ProductCard, product: Product, ctx: CardContext): CardView {
  const shown =
    product.variants.find(
      (v) => v.sku === (card.matched_variant_sku ?? card.default_variant_sku),
    ) ?? product.variants[0];
  if (!shown) throw new Error(`Produkt ${product.slug} nie ma wariantow`);
  const colorOf = (id: string) => ctx.colors.find((c) => c.id === id);
  const colorName = colorOf(shown.color)?.label ?? shown.color;

  const shots = packshotsFor(product.images, product.id, shown.images_key);
  const price = priceView({ price_gr: card.from_price_gr, lowest_30d_gr: card.lowest_30d_gr });
  const cheapest = priceVariant(product);

  const badges: CardBadge[] = [];
  if (price.percent !== null)
    badges.push({ variant: "promocja", text: promoBadgeText(price.percent) });
  for (const b of card.badges) badges.push({ variant: b });
  if (!card.in_stock) badges.push({ variant: "brak" });
  else if (cheapest && cheapest.stock >= 1 && cheapest.stock <= 3)
    badges.push({ variant: "ostatnie-sztuki" });

  const seen = new Set<string>();
  const colors: CardColor[] = [];
  for (const c of ctx.colors) {
    if (product.variants.some((v) => v.color === c.id) && !seen.has(c.id)) {
      seen.add(c.id);
      colors.push({ id: c.id, label: c.label, swatch: c.swatch });
    }
  }

  const base = `/${product.category}/${product.slug}`;
  return {
    id: product.id,
    slug: product.slug,
    category: product.category,
    name: product.name,
    href: card.matched_variant_sku ? `${base}?sku=${card.matched_variant_sku}` : base,
    sku: shown.sku,
    variantLabel: colorName,
    colorName,
    image: shots[0] ?? null,
    secondImage: secondShotFor(product.images, product.id, shown.images_key),
    params: keyParams(product, ctx.switches),
    priceGr: price.priceGr,
    omnibusGr: price.omnibusGr,
    omnibusText: price.omnibusGr === null ? null : omnibusSentence(price.omnibusGr),
    badges,
    colors,
  };
}

/** Dane do `data-track-item` karty: select_item i view_item_list czytaja je z DOM (karty sa serwerowe). */
export function cardTrackSource(view: CardView, categoryName: string, index: number) {
  return {
    sku: view.sku,
    name: view.name,
    category: view.category,
    priceGr: view.priceGr,
    listId: view.category,
    listName: categoryName,
    index,
  };
}
