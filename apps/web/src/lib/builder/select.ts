// F-103, F-102 (docs/03 §2): wybor wariantu po wyborze kafla - kolor z poprzednich krokow, przelacznik domyslny
// profilu, rozmiar podkladki wg przelacznika "cale biurko / pod myszke" i reguly szerokosci.
import type { Variant } from "@taktyl/contracts";
import type { SkuEntry } from "@taktyl/domain";
import { isBuyable } from "../catalog/variants";
import type { BuilderModel, BuilderProduct } from "./catalog";
import { padMargin, padSizesOfType, type PadKind } from "./fit";
import type { SetState, SlotKey } from "./types";

function defaultVariantOf(p: BuilderProduct): Variant {
  return p.variants.find((v) => v.sku === p.default_variant_sku) ?? (p.variants[0] as Variant);
}

/** Kolor z juz wybranych pozycji (klawiatura, myszka, podkladka), jesli model go ma. */
function preferredColor(model: BuilderModel, s: SetState, product: BuilderProduct, slot: SlotKey) {
  for (const other of ["k", "m", "p"] as const) {
    if (other === slot) continue;
    const sku = s[other];
    const color = sku === null ? undefined : model.bySku.get(sku)?.variant.color;
    if (color !== undefined && product.variants.some((v) => v.color === color)) return color;
  }
  return defaultVariantOf(product).color;
}

function preferBuyable(list: Variant[], fallback: Variant, all: Variant[]): Variant {
  return list.find(isBuyable) ?? all.find(isBuyable) ?? list[0] ?? fallback;
}

/** F-103: domyslny wariant modelu w kreatorze (przelacznik z profilu, kolor z setu, rozmiar z reguly szerokosci). */
export function pickVariant(
  model: BuilderModel,
  s: SetState,
  slot: SlotKey,
  product: BuilderProduct,
  padKind: PadKind,
): Variant {
  const base = defaultVariantOf(product);
  const color = preferredColor(model, s, product, slot);
  const sameColor = product.variants.filter((v) => v.color === color);

  if (slot === "k") {
    const sw = s.profile === null ? undefined : model.rules.profiles[s.profile]?.default_switch;
    const withSwitch = sw ? sameColor.filter((v) => v.switch === sw) : [];
    return preferBuyable(withSwitch.length ? withSwitch : sameColor, base, product.variants);
  }
  if (slot === "p") {
    const keyboard = s.k === null ? null : (model.index.get(s.k) ?? null);
    const kbW = keyboard?.product.attributes.dims_mm?.w ?? null;
    const sizes = padSizesOfType(product, padKind);
    const fitting = sizes.find(([, size]) => {
      const diff = padMargin(model, s.profile, kbW, size);
      return diff !== null && diff >= 0;
    });
    const chosen = fitting ?? sizes[sizes.length - 1];
    const bySize = chosen ? sameColor.filter((v) => v.size === chosen[0]) : [];
    return preferBuyable(bySize.length ? bySize : sameColor, base, product.variants);
  }
  return preferBuyable(sameColor, base, product.variants);
}

/**
 * F-103 (docs/03 §8): zmiana profilu przestawia przelacznik klawiatury na domyslny profilu, o ile klient sam go nie
 * wybral (switch_set_by_user). Zwraca SKU klawiatury po zmianie.
 */
export function retargetSwitch(
  model: BuilderModel,
  keyboard: SkuEntry | null,
  profile: string | null,
): string | null {
  if (!keyboard) return null;
  const sw = profile === null ? undefined : model.rules.profiles[profile]?.default_switch;
  const product = model.byId.get(keyboard.product.id);
  if (!sw || !product) return keyboard.variant.sku;
  const hit = product.variants.find(
    (v) => v.color === keyboard.variant.color && v.switch === sw && isBuyable(v),
  );
  return hit?.sku ?? keyboard.variant.sku;
}
