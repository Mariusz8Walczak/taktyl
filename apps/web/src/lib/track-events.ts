// F-242 (docs/10 §3-§5): typy zdarzen pomiaru. Nazwy i parametry bez zmian wzgledem docs/10 (regula 9, zasada 7:
// "zmiana nazwy = nowe zdarzenie"). ZERO danych osobowych (zasada 5): w tym pliku nie ma pol e-mail, telefon,
// imie, adres ani NIP; pilnuje tego test statyczny (test/track.test.ts) i filtr w track.ts.

/** Obiekt produktu `items[]` (docs/10 §3). Kwoty jako liczby w zlotych (749.9), nie teksty. */
export interface TrackItem {
  item_id: string;
  item_name: string;
  item_brand: "Taktyl";
  item_category: string;
  item_variant?: string;
  price: number;
  quantity: number;
  discount: number;
  promotion_name?: string;
  item_list_id?: string;
  item_list_name?: string;
  index?: number;
}

export type PaymentType = "blik" | "karta" | "przelew-online" | "przelew";
export type ShippingTier = "automat" | "kurier" | "odbior";
export type EntryPoint =
  "hero" | "nav" | "pdp" | "pdp_complete" | "preset" | "share_link" | "guide" | "account";
export type StepCategory = "klawiatura" | "myszka" | "podkladka";

interface Commerce {
  currency: "PLN";
  value: number;
}
interface WithItems {
  items: TrackItem[];
}
interface ListInfo {
  item_list_id: string;
  item_list_name: string;
}

/** Mapa: nazwa zdarzenia -> parametry (docs/10 §4 i §5). */
export interface TrackEventMap {
  view_item_list: WithItems & ListInfo;
  select_item: WithItems & ListInfo;
  view_item: WithItems & Commerce;
  add_to_wishlist: WithItems & Commerce;
  add_to_cart: WithItems & Commerce;
  remove_from_cart: WithItems & Commerce;
  view_cart: WithItems & Commerce;
  begin_checkout: WithItems & Commerce & { coupon?: string };
  add_shipping_info: WithItems & Commerce & { shipping_tier: ShippingTier; coupon?: string };
  add_payment_info: WithItems & Commerce & { payment_type: PaymentType; coupon?: string };
  purchase: WithItems &
    Commerce & {
      transaction_id: string;
      shipping: number;
      tax: number;
      coupon?: string;
    };
  search: { search_term: string };

  set_builder_start: { entry_point: EntryPoint };
  set_profile_select: { profile: string; hand_cm: number | null };
  set_step_complete: { step: StepCategory; item_id: string; item_name: string };
  set_fit_warning: { rule: string; profile: string; item_ids: string[] };
  set_suggestion_apply: {
    rule: string;
    from_item_id: string;
    to_item_id: string;
    value_delta: number;
  };
  set_complete: { value: number; discount: number; profile: string; warnings: number };
  set_share: { method: "clipboard" | "fallback" };
  set_save: { value: number };
  set_add_to_cart: {
    value: number;
    discount: number;
    profile: string;
    preset_id?: string;
    warnings: number;
  };
  filter_apply: { item_list_id: string; filter_name: string; filter_value: string };
  compare_add: { item_id: string; compare_count: number };
  shortcut_use: { key: "/" | "esc" | "?" };
  payment_failed: { transaction_id: string; payment_type: PaymentType; value: number };
  generate_lead: { form_id: "kontakt" | "newsletter"; value: 0; currency: "PLN" };
  return_request: { transaction_id: string; value: number };
}

export type TrackEventName = keyof TrackEventMap;
