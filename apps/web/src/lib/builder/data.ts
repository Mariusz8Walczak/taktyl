// F-100...F-111 (docs/03, docs/14 §6, docs/16 §2): dane kreatora z API dla komponentu serwerowego strony.
// Znaczniki: produkty `product:{slug}` + `category:{k}`, slowniki `catalog`, reguly `rules`, sety `presets`,
// ustawienia `shop-settings` - zmiana w backpanelu odswieza kreator (ADR-0003). Przegladarka nie woluje API (WEB-002).
import { presetsResponseSchema, rulesSchema } from "@taktyl/contracts";
import type { CategoryId } from "@taktyl/contracts";
import type { RulesConfig } from "@taktyl/domain";
import { cache } from "react";
import { apiGet } from "../api/client";
import { getColors, getListing, getProduct, getShopSettings, getSwitches } from "../api";
import { TAG } from "../api/tags";
import { toBuilderProduct, type BuilderData, type BuilderProduct } from "./catalog";

/** Reguly dopasowania (profile, strefy myszki, komunikaty) - jedno wywolanie na zadanie. */
export const getRules = cache(
  async (): Promise<RulesConfig> =>
    (await apiGet("/v1/rules", rulesSchema, { tags: [TAG.rules] })) as unknown as RulesConfig,
);

const CATEGORIES: readonly CategoryId[] = ["klawiatury", "myszki", "podkladki"];

async function loadProducts(): Promise<BuilderProduct[]> {
  const lists = await Promise.all(
    CATEGORIES.map((category) =>
      getListing({ category, filters: {}, sort: "polecane", limit: 48 }).then((r) =>
        r.items.map((card) => ({ category, slug: card.slug })),
      ),
    ),
  );
  const full = await Promise.all(
    lists.flat().map(({ category, slug }) => getProduct(slug, category)),
  );
  return full.flatMap((p) => (p ? [toBuilderProduct(p)] : []));
}

/** Wszystko, czego potrzebuje wyspa kreatora (jedno renderowanie serwerowe, potem zero zapytan z przegladarki). */
export async function loadBuilderData(): Promise<BuilderData> {
  const [products, colors, switches, rules, presets, settings] = await Promise.all([
    loadProducts(),
    getColors(),
    getSwitches(),
    getRules(),
    apiGet("/v1/presets", presetsResponseSchema, { tags: [TAG.presets] }),
    getShopSettings(),
  ]);
  return {
    products,
    colors: colors.map((c) => ({
      id: c.id,
      label: c.label,
      swatch: c.swatch,
      harmony: c.harmony,
      code: c.code,
    })),
    switches: switches.map((s) => ({
      id: s.id,
      name: s.name,
      type_label: s.type_label,
      force_g: s.force_g,
      sound: s.sound,
    })),
    rules,
    presets: presets.items.map((p) => ({
      id: p.id,
      name: p.name,
      profile: p.profile,
      note: p.note,
      skus: p.items.map((i) => i.sku),
      sum_gr: p.sum_gr,
      set_discount_gr: p.set_discount_gr,
      total_gr: p.total_gr,
    })),
    setDiscount: {
      percent: settings.set_discount.percent,
      categories: settings.set_discount.categories,
    },
  };
}
