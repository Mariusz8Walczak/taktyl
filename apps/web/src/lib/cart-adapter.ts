// F-066, F-110, F-150, A-03 (ADR-0007, docs/03 §7): cienka fasada nad modulem koszyka `lib/cart` (TAKTYL-39).
// Publiczne API dla karty produktu i kreatora setu: `addToCart` / `addItem` (pozycja), `addSet` (grupa setu).
// Sygnatury nie zmieniaja sie wzgledem tymczasowego adaptera. Po zapisaniu: szuflada koszyka sie otwiera (A-03)
// i przycisk pokazuje "Dodano" (hook `useRecentlyAdded`). Zdarzenie `add_to_cart` wysyla WOLAJACY po `ok: true`
// (docs/10 §1 zasada 2; ma ceny i nazwy z karty lub kreatora), np. przez `buildItem` / `buildSetItems` z track-items.
import { cartStore } from "./cart/store";
import { cartUi } from "./cart/ui";
import { MAX_ITEM_QTY } from "./cart/types";

export interface AddToCartInput {
  sku: string;
  qty: number;
}

export interface AddToCartResult {
  /** true dopiero po zapisaniu pozycji; toast i zdarzenie `add_to_cart` tylko wtedy. */
  ok: boolean;
}

export interface AddSetInput {
  /** Dokladnie 3 SKU: klawiatura, myszka, podkladka. */
  skus: readonly [string, string, string] | readonly string[];
  profile?: string | null;
  presetId?: string | null;
  name?: string;
  qty?: number;
  /** Edycja grupy (`/zbuduj-set?...&edytuj=<id>`): zapis zastepuje te grupe w tym samym miejscu (docs/decyzje WEB-040). */
  replaceId?: string;
}

export interface AddSetResult extends AddToCartResult {
  /** Identyfikator grupy w koszyku. */
  id?: string;
}

function afterAdd(): void {
  cartUi.markAdded();
  cartUi.open();
}

export async function addToCart({ sku, qty }: AddToCartInput): Promise<AddToCartResult> {
  if (typeof window === "undefined" || !Number.isInteger(qty) || qty < 1) return { ok: false };
  try {
    cartStore.addItem(sku, Math.min(MAX_ITEM_QTY, qty));
    afterAdd();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Alias `addToCart`: nazwa uzywana przez kreator setu. */
export const addItem = addToCart;

export async function addSet(input: AddSetInput): Promise<AddSetResult> {
  if (typeof window === "undefined") return { ok: false };
  try {
    const res = cartStore.addSet({
      skus: input.skus,
      profile: input.profile,
      presetId: input.presetId,
      name: input.name,
      qty: input.qty,
      replaceId: input.replaceId,
    });
    if (!res) return { ok: false };
    afterAdd();
    return { ok: true, id: res.id };
  } catch {
    return { ok: false };
  }
}
