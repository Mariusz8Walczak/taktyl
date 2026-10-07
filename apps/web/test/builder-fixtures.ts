// Fixtury kreatora (TAKTYL-34/35/38): caly katalog, reguly, sety i ustawienia z data/*.json (zrodlo seedu), w ksztalcie,
// w jakim trafiaja do wyspy kreatora. Wartosci oczekiwane w testach wynikaja z tych danych, nie z recznie wpisanych liczb.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RulesConfig } from "@taktyl/domain";
import { allocateDiscount, priceSet, toGrosze } from "@taktyl/domain";
import {
  createModel,
  toBuilderProduct,
  type BuilderData,
  type BuilderModel,
} from "../src/lib/builder/catalog";
import { EMPTY_STATE, type SetState } from "../src/lib/builder/types";
import { COLORS, productFixture, SWITCHES } from "./catalog-fixtures";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(root, rel), "utf8")) as T;

interface RawPreset {
  id: string;
  name: string;
  profile: string;
  skus: string[];
  note: string;
  sum: number;
  set_discount: number;
  total: number;
}
interface RawShop {
  set_discount: { percent: number; requires_categories: string[] };
}

export const RAW_PRESETS = read<RawPreset[]>("data/presets.json");
export const SHOP = read<RawShop>("data/shop.json");
export const RULES = read<RulesConfig>("data/rules.json");
const RAW_SWITCHES = read<{ id: string; sound: string }[]>("data/switches.json");

const slugs = read<{ slug: string }[]>("data/products.json").map((p) => p.slug);

export function builderData(): BuilderData {
  return {
    products: slugs.map((s) => toBuilderProduct(productFixture(s))),
    colors: COLORS,
    switches: SWITCHES.map((s) => ({
      ...s,
      sound: RAW_SWITCHES.find((x) => x.id === s.id)?.sound ?? "",
    })),
    rules: RULES,
    presets: RAW_PRESETS.map((p) => ({
      id: p.id,
      name: p.name,
      profile: p.profile,
      note: p.note,
      skus: p.skus,
      sum_gr: toGrosze(p.sum),
      set_discount_gr: toGrosze(p.set_discount),
      total_gr: toGrosze(p.total),
    })),
    setDiscount: {
      percent: SHOP.set_discount.percent,
      categories: SHOP.set_discount.requires_categories,
    },
  };
}

export const model: BuilderModel = createModel(builderData());

export const state = (patch: Partial<SetState> = {}): SetState => ({ ...EMPTY_STATE, ...patch });

/** Kontrola rabatu: suma i rabat liczone niezaleznie od kreatora (kroki z docs/03 §6). */
export function expectedSetPrice(skus: string[]) {
  const items = skus.map((sku) => {
    const e = model.index.get(sku);
    if (!e) throw new Error(`brak ${sku}`);
    return { sku, category: e.product.category, price: e.variant.price };
  });
  const sum = items.reduce((a, i) => a + i.price, 0);
  const discount = Math.round((sum * SHOP.set_discount.percent) / 100);
  return {
    sum,
    discount,
    total: sum - discount,
    shares: allocateDiscount(
      items.map((i) => i.price),
      discount,
    ),
    priced: priceSet(items, {
      percent: SHOP.set_discount.percent,
      requiresCategories: SHOP.set_discount.requires_categories,
    }),
  };
}
