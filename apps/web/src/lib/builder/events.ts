// F-110, F-069 (docs/10 §4-§5): wspolne zdarzenia dodania setu do koszyka - `add_to_cart` (trzy pozycje z rabatem
// rozbitym przez domene, suma discount = rabat setu) i `set_add_to_cart`. Uzywaja go kreator i blok "Dokoncz set".
import type { SkuEntry } from "@taktyl/domain";
import { track } from "../track";
import { buildSetItems, itemsDiscount, itemsValue } from "../track-items";
import { variantText, type BuilderModel, type BuilderProduct } from "./catalog";

export interface SetAddedInput {
  model: BuilderModel;
  entries: readonly [SkuEntry, SkuEntry, SkuEntry];
  /** Rabat setu w groszach (z priceSet). */
  discountGr: number;
  profile: string | null;
  presetId: string | null;
  warnings: number;
  listId: "kreator-setu" | "dokoncz-set";
  listName: string;
}

/** Po potwierdzeniu zapisu w koszyku (docs/10 §1 zasada 2): `add_to_cart` i `set_add_to_cart`. */
export function trackSetAdded(i: SetAddedInput): void {
  const lines = i.entries.map((e, idx) => {
    const bp = i.model.byId.get(e.product.id) as BuilderProduct;
    const bv = bp.variants.find((v) => v.sku === e.variant.sku) ?? bp.variants[0];
    return {
      sku: e.variant.sku,
      name: e.product.name,
      category: e.product.category,
      ...(bv ? { variant: variantText(i.model, bp, bv) } : {}),
      priceGr: e.variant.price,
      listId: i.listId,
      listName: i.listName,
      index: idx,
    };
  });
  const items = buildSetItems(lines, i.discountGr, `Rabat za set ${i.model.setDiscount.percent}%`);
  track("add_to_cart", { items, currency: "PLN", value: itemsValue(items) });
  track("set_add_to_cart", {
    value: itemsValue(items),
    discount: itemsDiscount(items),
    profile: i.profile ?? "no_profile",
    ...(i.presetId ? { preset_id: i.presetId } : {}),
    warnings: i.warnings,
  });
}
