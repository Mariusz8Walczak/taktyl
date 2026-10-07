// F-069 (B-217): "Dokoncz set" - dobor dwoch pozostalych kategorii wg profilu z najwyzszym fit produktu.
// Cena setu z domeny (priceSet), dobor podkladki z domeny (cheapestCompliantPad).
import {
  cheapestCompliantPad,
  priceSet,
  type Product,
  type RulesConfig,
  type SkuEntry,
  type Variant,
} from "@taktyl/domain";

const CATEGORY_ORDER = ["klawiatury", "myszki", "podkladki"] as const;
const PROFILE_ORDER = ["fps", "gry", "programowanie", "biuro", "cisza"] as const;

export type SetProfile = (typeof PROFILE_ORDER)[number];

/** Profil z najwyzszym fit produktu; remis: kolejnosc fps, gry, programowanie, biuro, cisza. */
export function bestProfile(product: Product): SetProfile {
  let best: SetProfile = PROFILE_ORDER[0];
  for (const p of PROFILE_ORDER) {
    if ((product.fit[p] ?? 0) > (product.fit[best] ?? 0)) best = p;
  }
  return best;
}

function cheapestAvailable(variants: readonly Variant[]): Variant | undefined {
  return [...variants]
    .filter((v) => v.stock > 0)
    .sort((a, b) => a.price - b.price || a.sku.localeCompare(b.sku))[0];
}

function pickFor(
  category: string,
  products: readonly Product[],
  profile: SetProfile,
  anchor: Variant,
  defaultSwitch: string | undefined,
): SkuEntry | null {
  const candidates = products
    .filter((p) => p.category === category && cheapestAvailable(p.variants))
    .map((p) => ({ p, price: (cheapestAvailable(p.variants) as Variant).price }))
    .sort(
      (a, b) =>
        (b.p.fit[profile] ?? 0) - (a.p.fit[profile] ?? 0) ||
        a.price - b.price ||
        a.p.id.localeCompare(b.p.id),
    );
  const best = candidates[0]?.p;
  if (!best) return null;
  const score = (v: Variant): number =>
    (v.color === anchor.color ? 2 : 0) +
    (defaultSwitch !== undefined && v.switch === defaultSwitch ? 1 : 0);
  const variant = [...best.variants]
    .filter((v) => v.stock > 0)
    .sort((a, b) => score(b) - score(a) || a.price - b.price || a.sku.localeCompare(b.sku))[0];
  return variant ? { product: best, variant } : null;
}

export interface CompleteSetResult {
  profile: SetProfile;
  entries: SkuEntry[];
}

export function completeSet(
  anchor: SkuEntry,
  profileOverride: SetProfile | undefined,
  products: readonly Product[],
  rules: RulesConfig,
): CompleteSetResult | null {
  const profile = profileOverride ?? bestProfile(anchor.product);
  const defaultSwitch = rules.profiles[profile]?.default_switch;
  const chosen = new Map<string, SkuEntry>([[anchor.product.category, anchor]]);
  for (const category of CATEGORY_ORDER) {
    if (category === "podkladki" || chosen.has(category)) continue;
    const pick = pickFor(category, products, profile, anchor.variant, defaultSwitch);
    if (!pick) return null;
    chosen.set(category, pick);
  }
  if (!chosen.has("podkladki")) {
    const pad =
      cheapestCompliantPad(
        {
          profile,
          keyboard: chosen.get("klawiatury") ?? null,
          mouse: chosen.get("myszki") ?? null,
        },
        rules,
        products,
      ) ?? pickFor("podkladki", products, profile, anchor.variant, defaultSwitch);
    if (!pad) return null;
    chosen.set("podkladki", pad);
  }
  return { profile, entries: CATEGORY_ORDER.map((c) => chosen.get(c) as SkuEntry) };
}

export function priceEntries(
  entries: readonly SkuEntry[],
  percent: number,
  categories: readonly string[],
) {
  return priceSet(
    entries.map((e) => ({
      sku: e.variant.sku,
      category: e.product.category,
      price: e.variant.price,
    })),
    { percent, requiresCategories: categories },
  );
}
