// F-104, F-105, F-107 (docs/03 §4, §6): analiza biezacego setu na zywo. Cala logika (reguly, propozycje, cena, rabat)
// pochodzi z @taktyl/domain; tu tylko sklejenie stanu kreatora z funkcjami domeny i widok dla komponentow.
import {
  cheapestCompliantPad,
  evaluateFit,
  formatMmAsCm,
  formatPLN,
  mouseZoneMm,
  priceSet,
  type FitReport,
  type PadSize,
  type SetItem,
  type SetPrice,
  type SkuEntry,
} from "@taktyl/domain";
import type { DeskResult } from "@taktyl/ui";
import { attrs, entryOf, type BuilderModel, type BuilderProduct } from "./catalog";
import { SLOT_CATEGORY, SLOT_LABEL, SLOTS, type SetState, type SlotKey } from "./types";

export interface Analysis {
  entries: Record<SlotKey, SkuEntry | null>;
  report: FitReport;
  deskResult: DeskResult | null;
  /** Wycena wybranych pozycji (rabat tylko przy komplecie trzech kategorii). */
  price: SetPrice;
  count: number;
  complete: boolean;
  /** Zdanie o rabacie dla niepelnego setu (docs/03 §6) albo null. */
  discountHint: string | null;
  /** SKU z brakiem stanu (wybrane, ale niedostepne). */
  soldOut: SlotKey[];
}

function padSizeOf(e: SkuEntry): PadSize | undefined {
  const key = e.variant.size;
  return key === undefined ? undefined : e.product.attributes.sizes?.[key];
}

/**
 * Wynik reguly szerokosci: roznica w mm miedzy szerokoscia podkladki a wymaganiem (>= 0 = miesci sie).
 * Typ "biurko": 2*margines + klawiatura + odstep + strefa; typ "mysz": strefa (docs/03 §4.2).
 */
export function padMargin(
  model: BuilderModel,
  profile: string | null,
  keyboardWidthMm: number | null,
  size: Pick<PadSize, "w" | "type">,
): number | null {
  const zone = mouseZoneMm(profile, model.rules);
  if (size.type === "mysz") return size.w - zone;
  if (keyboardWidthMm === null) return null;
  const required =
    2 * model.rules.edge_margin_mm + keyboardWidthMm + model.rules.gap_keyboard_mouse_mm + zone;
  return size.w - required;
}

function deskResult(model: BuilderModel, s: SetState, e: Analysis["entries"]): DeskResult | null {
  const { k, m, p } = e;
  if (!p || !m) return null;
  const size = padSizeOf(p);
  if (!size) return null;
  const kbW = k?.product.attributes.dims_mm?.w ?? null;
  if (size.type === "biurko" && kbW === null) return null;
  const diff = padMargin(model, s.profile, kbW, size);
  if (diff === null) return null;
  return diff >= 0 ? { status: "ok", spareMm: diff } : { status: "uwaga", shortfallMm: -diff };
}

function toItem(e: SkuEntry): SetItem {
  return { sku: e.variant.sku, category: e.product.category, price: e.variant.price };
}

function discountHint(model: BuilderModel, s: SetState, e: Analysis["entries"]): string | null {
  const chosen = SLOTS.filter((slot) => e[slot] !== null);
  const missing = SLOTS.filter((slot) => e[slot] === null);
  if (missing.length === 0 || chosen.length === 0) return null;
  const rule = {
    percent: model.setDiscount.percent,
    requiresCategories: model.setDiscount.categories,
  };
  if (missing.length > 1) {
    const names = missing.map((slot) => SLOT_LABEL[slot].acc).join(" i ");
    return `Dodaj ${names}, a rabat ${rule.percent}% obejmie cały set.`;
  }
  const slot = missing[0] as SlotKey;
  let candidate: SkuEntry | null = null;
  if (slot === "p") {
    candidate = cheapestCompliantPad(
      { profile: s.profile, keyboard: e.k, mouse: e.m },
      model.rules,
      model.domainProducts,
    );
  } else {
    const category = SLOT_CATEGORY[slot];
    for (const product of model.domainProducts) {
      if (product.category !== category) continue;
      for (const variant of product.variants) {
        if (variant.stock > 0 && (!candidate || variant.price < candidate.variant.price))
          candidate = { product, variant };
      }
    }
  }
  if (!candidate) return null;
  const items = [...chosen.map((x) => toItem(e[x] as SkuEntry)), toItem(candidate)];
  const { discount } = priceSet(items, rule);
  return `Dodaj ${SLOT_LABEL[slot].acc}, a rabat ${rule.percent}% obejmie cały set (−${formatPLN(discount)}).`;
}

export function analyze(model: BuilderModel, s: SetState): Analysis {
  const entries = {
    k: entryOf(model, s.k),
    m: entryOf(model, s.m),
    p: entryOf(model, s.p),
  };
  const report = evaluateFit(
    {
      profile: s.profile,
      handCm: s.handCm,
      keyboard: entries.k,
      mouse: entries.m,
      pad: entries.p,
    },
    model.rules,
    model.colorsConfig,
    model.domainProducts,
  );
  const items = SLOTS.flatMap((slot) => {
    const e = entries[slot];
    return e ? [toItem(e)] : [];
  });
  const price = priceSet(items, {
    percent: model.setDiscount.percent,
    requiresCategories: model.setDiscount.categories,
  });
  return {
    entries,
    report,
    deskResult: deskResult(model, s, entries),
    price,
    count: items.length,
    complete: items.length === 3,
    discountHint: discountHint(model, s, entries),
    soldOut: SLOTS.filter((slot) => {
      const e = entries[slot];
      return e !== null && e.variant.stock <= 0;
    }),
  };
}

export type PadKind = "biurko" | "mysz";

/** Rozmiary podkladki danego typu, od najmniejszego (F-103). */
export function padSizesOfType(product: BuilderProduct, type: PadKind): [string, PadSize][] {
  if (product.category !== "podkladki") return [];
  return (Object.entries(attrs(product).sizes ?? {}) as [string, PadSize | undefined][])
    .filter((x): x is [string, PadSize] => x[1] !== undefined && x[1].type === type)
    .sort((a, b) => a[1].w - b[1].w);
}

/**
 * Kafel podkladki (docs/03 §2 krok 3): wynik reguly szerokosci dla biezacej klawiatury i profilu, zanim klient
 * wybierze ("mieści się, zapas 10,3 cm" / "za wąska o 1 cm"). Liczony dla najwiekszego rozmiaru wybranego typu.
 */
export function padTileHint(
  model: BuilderModel,
  profile: string | null,
  keyboard: SkuEntry | null,
  product: BuilderProduct,
  type: PadKind,
): string | null {
  const sizes = padSizesOfType(product, type);
  const largest = sizes[sizes.length - 1];
  if (!largest) return null;
  const diff = padMargin(
    model,
    profile,
    keyboard?.product.attributes.dims_mm?.w ?? null,
    largest[1],
  );
  if (diff === null) return null;
  return diff >= 0
    ? `${largest[1].label}: mieści się, zapas ${formatMmAsCm(diff)}`
    : `${largest[1].label}: za wąska o ${formatMmAsCm(-diff)}`;
}
