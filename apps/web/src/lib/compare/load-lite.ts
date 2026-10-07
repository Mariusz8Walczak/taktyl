// F-131, F-132 (docs/14 §6, docs/16 §2): katalog w wersji lekkiej dla stron /porownaj i /ulubione (komponenty
// serwerowe). API nie ma listy po ID, wiec czytamy listingi trzech kategorii i karty produktow (znaczniki
// `category:{k}` i `product:{slug}` jak kreator, zmiana w backpanelu odswieza porownanie; ADR-0003).
import type { CategoryId } from "@taktyl/contracts";
import { cache } from "react";
import { getColors, getListing, getProduct, getSwitches } from "../api";
import { toLiteProduct, type LiteProduct } from "./lite";

const CATEGORIES: readonly CategoryId[] = ["klawiatury", "myszki", "podkladki"];

export const loadCatalogLite = cache(async (): Promise<LiteProduct[]> => {
  const [colors, switches, lists] = await Promise.all([
    getColors(),
    getSwitches(),
    Promise.all(
      CATEGORIES.map((category) =>
        getListing({ category, filters: {}, sort: "polecane", limit: 48 }).then((r) =>
          r.items.map((card) => ({ category, slug: card.slug })),
        ),
      ),
    ),
  ]);
  const full = await Promise.all(
    lists.flat().map(({ category, slug }) => getProduct(slug, category)),
  );
  return full.flatMap((p) => (p ? [toLiteProduct(p, colors, switches)] : []));
});
