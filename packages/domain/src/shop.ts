// F-152, F-153, F-155, F-065: konfiguracja sklepu z shop.json (kwoty w groszach).
import { toGrosze, type Grosze } from "./money.js";

/** Ksztalt data/shop.json (pola uzywane przez domene). */
export interface RawShop {
  timezone: string;
  free_shipping_threshold: number;
  set_discount: { percent: number; requires_categories: string[] };
  shipping_methods: { id: string; label: string; price: number; eta_business_days: number }[];
  dispatch: { cutoff_hour: number };
  codes: { code: string; type: "percent" | "free_shipping"; value?: number }[];
}

export interface ShippingMethod {
  id: string;
  label: string;
  price: Grosze;
  etaBusinessDays: number;
}

export interface DiscountCode {
  code: string;
  type: "percent" | "free_shipping";
  /** Procent dla type = "percent". */
  value: number;
}

export interface ShopConfig {
  timeZone: string;
  freeShippingThreshold: Grosze;
  setDiscount: { percent: number; requiresCategories: readonly string[] };
  shippingMethods: ShippingMethod[];
  dispatchCutoffHour: number;
  codes: DiscountCode[];
}

/** F-155: konfiguracja z JSON-a; kwoty zamieniane na grosze raz, tutaj. */
export function buildShopConfig(raw: RawShop): ShopConfig {
  return {
    timeZone: raw.timezone,
    freeShippingThreshold: toGrosze(raw.free_shipping_threshold),
    setDiscount: {
      percent: raw.set_discount.percent,
      requiresCategories: raw.set_discount.requires_categories,
    },
    shippingMethods: raw.shipping_methods.map((m) => ({
      id: m.id,
      label: m.label,
      price: toGrosze(m.price),
      etaBusinessDays: m.eta_business_days,
    })),
    dispatchCutoffHour: raw.dispatch.cutoff_hour,
    codes: raw.codes.map((c) => ({ code: c.code, type: c.type, value: c.value ?? 0 })),
  };
}
