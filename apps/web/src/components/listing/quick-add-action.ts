"use server";
// F-043 (TAKTYL-59): akcja serwerowa dla panelu "Szybko dodaj". Przegladarka nie woluje API wprost (WEB-002), wiec
// warianty produktu (kolory, przelaczniki, rozmiary, ceny, stany) pobiera serwer z cache danych Next (znacznik
// `product:{slug}`) i oddaje tylko to, czego potrzebuje wybor wariantu. Ceny sa tylko do wyswietlenia: koszyk
// dostaje SKU, a ceny liczy `POST /cart/quote` (F-157).
import { categoryIdSchema } from "@taktyl/contracts";
import { getColors, getProduct, getSwitches } from "../../lib/api";
import { toClientProduct, type ClientProduct } from "../../lib/catalog/product-view";
import type { ColorInfo, SwitchInfo } from "../product/product-context";

export interface QuickAddData {
  product: ClientProduct;
  colors: ColorInfo[];
  switches: SwitchInfo[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function loadQuickAddData(
  slug: string,
  category: string,
): Promise<QuickAddData | null> {
  const cat = categoryIdSchema.safeParse(category);
  if (!cat.success || !SLUG.test(slug) || slug.length > 80) return null;
  const [product, colors, switches] = await Promise.all([
    getProduct(slug, cat.data),
    getColors(),
    getSwitches(),
  ]);
  if (!product) return null;
  return {
    product: toClientProduct(product),
    colors: colors.map((c) => ({ id: c.id, label: c.label, swatch: c.swatch })),
    switches: switches.map((s) => ({
      id: s.id,
      name: s.name,
      type_label: s.type_label,
      force_g: s.force_g,
    })),
  };
}
