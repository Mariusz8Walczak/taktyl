// B-622 (docs/25 par. 5, ADR-0012): plan historii demonstracyjnej - ok. 90 dni zamowien i ruchu. Czysta logika bez I/O,
// deterministyczna (stale ziarno): ta sama chwila `now` i ten sam katalog daja ten sam plan. Wylacznie istniejace produkty,
// warianty, sety i slowniki konfiguratora z bazy (nic nie jest dopisywane do katalogu). Ceny i rabaty liczy potem prawdziwa
// wycena koszyka i zamowien (wykonawca w generator.ts), plan wybiera tylko CO i KIEDY.
import { CONFIG_SKU_PATTERN, type CartLine, type CategoryId, type ProfileId } from "@taktyl/contracts";
import {
  configurationSku,
  defaultConfiguration,
  resolveConfiguration,
  type ConfData,
  type ConfModel,
  type Configuration,
} from "@taktyl/domain";
import { warsawDayStart } from "../common/warsaw.js";
import { addDays, warsawDateOf, warsawDowHourOf } from "../stats/range.js";

export const DEMO_HISTORY_SEED = 20261125;
export const DEMO_HISTORY_DAYS = 90;
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

// ---------------------------------------------------------------- losowosc

export type Rng = () => number;

/** mulberry32: maly, deterministyczny generator liczb [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)] as T;

export function weighted<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r < 0) return v;
  }
  return (items[items.length - 1] as readonly [T, number])[0];
}

/** Rozklad Poissona (Knuth) dla malych srednich. */
export function poisson(rng: Rng, mean: number): number {
  const l = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > l);
  return k - 1;
}

const between = (rng: Rng, a: number, b: number): number => a + rng() * (b - a);

/** Identyfikator w stylu UUID z generatora (klucz idempotencji zamowienia demo). */
export function demoUuid(rng: Rng): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(rng() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Anonimowy identyfikator sesji (wzorzec z kontraktu B-621). */
export function demoSessionId(rng: Rng): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return `demo_${Array.from({ length: 14 }, () => pick(rng, [...abc])).join("")}`;
}

// ---------------------------------------------------------------- wejscie

export interface PlanVariant {
  sku: string;
  color: string;
  priceGr: number;
  label: string;
}
export interface PlanProduct {
  id: string;
  name: string;
  category: CategoryId;
  variants: PlanVariant[];
}
export interface PlanPreset {
  id: string;
  name: string;
  profile: ProfileId;
  skus: [string, string, string];
}
export interface PlanInput {
  now: Date;
  days?: number;
  seed?: number;
  products: PlanProduct[];
  presets: PlanPreset[];
  pickupPoints: string[];
  payments: string[];
  shipping: string[];
  coupons: string[];
  conf: ConfData | null;
}

// ---------------------------------------------------------------- wyjscie

export interface PlannedOrder {
  idempotencyKey: string;
  /** null = klient nie zgodzil sie na analityke (zamowienie bez zdarzen) */
  sessionId: string | null;
  sessionStart: Date;
  createdAt: Date;
  lines: CartLine[];
  /** set z kreatora (zdarzenia set_*) i punkt wejscia */
  builder: { entryPoint: string; profile: ProfileId } | null;
  listId: CategoryId | "polecane" | "wyszukiwarka" | "kreator-setu";
  shipping: "automat" | "kurier" | "odbior";
  point: string;
  payment: string;
  coupon: string | null;
  contactNo: number;
  city: string;
  /** nieudana proba platnosci przed sukcesem (lub jedyna proba) */
  failedAt: Date | null;
  paidAt: Date | null;
  processingAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

export interface PlannedEvent {
  name: string;
  params: Record<string, unknown>;
  ts: Date;
}
export interface PlannedSession {
  sessionId: string;
  events: PlannedEvent[];
}

export interface DemoPlan {
  orders: PlannedOrder[];
  sessions: PlannedSession[];
}

// ---------------------------------------------------------------- rozklady

/** Waga godziny w Europe/Warsaw: poludnie i wieczor, malo w nocy. */
const HOUR_WEIGHTS = [
  0.4, 0.2, 0.1, 0.1, 0.1, 0.2, 0.5, 1.0, 1.6, 2.0, 2.3, 2.4, 2.6, 2.5, 2.3, 2.2, 2.3, 2.5, 2.8, 3.2, 3.4, 3.0, 2.0, 1.0,
] as const;
/** Mnoznik dnia tygodnia (1 = poniedzialek); niedziela wieczorem kupuje sie najwiecej. */
const DOW_FACTOR: Record<number, number> = { 1: 1.0, 2: 1.05, 3: 1.0, 4: 1.08, 5: 0.95, 6: 0.8, 7: 1.12 };
const COLOR_WEIGHT: Record<string, number> = { grafit: 40, mgla: 25, kobalt: 20, naturalny: 15 };
const CITIES = ["Warszawa", "Kraków", "Gdańsk", "Poznań", "Wrocław", "Łódź", "Lublin", "Szczecin"];
const ENTRY_POINTS = ["hero", "nav", "pdp", "pdp_complete", "preset", "share_link", "guide"] as const;
const PROFILES: ProfileId[] = ["fps", "gry", "programowanie", "biuro", "cisza"];
const SEARCH_TERMS = [
  "cicha klawiatura",
  "lekka mysz",
  "podkładka xl",
  "klawiatura 75",
  "przełącznik szept",
  "mysz bezprzewodowa",
  "podkładka filc",
  "klawiatura do programowania",
  "set do gier",
  "hot swap",
];

/** Losowa chwila w dniu RRRR-MM-DD wg wag godzin (czas Warszawy). */
function momentIn(rng: Rng, date: string): Date {
  const hour = weighted(
    rng,
    HOUR_WEIGHTS.map((w, h) => [h, w] as const),
  );
  return new Date(warsawDayStart(date).getTime() + hour * HOUR + Math.floor(rng() * 60) * MIN + Math.floor(rng() * 60) * 1000);
}

// ---------------------------------------------------------------- konfiguracje wlasne (ADR-0011)

function paletteColors(d: ConfData, id: string, depth = 0): string[] {
  const p = d.palettes[id];
  if (!p || depth > 2) return [];
  if (Array.isArray(p.kolory)) return p.kolory;
  const ref = p.kolory.replace(/^jak\s+/, "").trim();
  return paletteColors(d, ref, depth + 1);
}

const SKIP_PARTS = /legend|podswietl|nadruk|spod/;

/** Losowa, poprawna konfiguracja modelu (kolory z palet, wykonczenia z palet) albo null. */
export function randomConfiguration(rng: Rng, d: ConfData, model: ConfModel): Configuration | null {
  const cfg = defaultConfiguration(model);
  for (const part of model.parts) {
    if (!part.konfigurowalna || !part.paleta || SKIP_PARTS.test(part.id)) continue;
    if (rng() < 0.4) continue;
    const colors = paletteColors(d, part.paleta).filter((c) => d.colors[c]);
    if (colors.length === 0) continue;
    const finishes = d.palettes[part.paleta]?.wykonczenia ?? [];
    cfg.parts[part.id] = {
      color: pick(rng, colors),
      finish: finishes.length > 0 ? pick(rng, finishes) : (cfg.parts[part.id]?.finish ?? null),
    };
  }
  if (model.id.startsWith("k-")) {
    const switches = Object.keys(d.switches).sort();
    if (switches.length > 0) cfg.switch = pick(rng, switches);
  }
  const resolved = resolveConfiguration(d, cfg);
  return resolved.ok ? resolved.config : null;
}

// ---------------------------------------------------------------- plan

function chooseVariant(rng: Rng, p: PlanProduct): PlanVariant {
  return weighted(
    rng,
    p.variants.map((v) => [v, COLOR_WEIGHT[v.color] ?? 3] as const),
  );
}

interface Catalog {
  byCategory: Record<CategoryId, { product: PlanProduct; weight: number }[]>;
  all: { product: PlanProduct; weight: number }[];
}

function catalogOf(rng: Rng, products: PlanProduct[]): Catalog {
  // Popularnosc produktow: rozklad Zipfa po kolejnosci wylosowanej raz na plan (deterministycznie).
  const shuffled = [...products].sort((a, b) => a.id.localeCompare(b.id)).map((p) => ({ p, r: rng() }));
  shuffled.sort((a, b) => a.r - b.r);
  const all = shuffled.map(({ p }, i) => ({ product: p, weight: 1 / (1 + i * 0.35) }));
  const byCategory = { klawiatury: [], myszki: [], podkladki: [] } as Catalog["byCategory"];
  for (const e of all) byCategory[e.product.category].push(e);
  return { byCategory, all };
}

const pickProduct = (rng: Rng, list: { product: PlanProduct; weight: number }[]): PlanProduct =>
  weighted(
    rng,
    list.map((e) => [e.product, e.weight] as const),
  );

function nextWorkingMoment(rng: Rng, from: Date, minHours: number, maxHours: number): Date {
  let t = new Date(from.getTime() + between(rng, minHours, maxHours) * HOUR);
  // Magazyn pracuje 8-18 w dni robocze (czas Warszawy): przesuwamy poza tym oknem.
  for (let guard = 0; guard < 10; guard++) {
    const { dow, hour } = warsawDowHourOf(t);
    if (dow <= 5 && hour >= 8 && hour < 18) break;
    const date = hour >= 18 || dow > 5 ? addDays(warsawDateOf(t), 1) : warsawDateOf(t);
    t = new Date(warsawDayStart(date).getTime() + 8 * HOUR + Math.floor(rng() * 180) * MIN);
  }
  return t;
}

export function planDemoHistory(input: PlanInput): DemoPlan {
  const rng = mulberry32(input.seed ?? DEMO_HISTORY_SEED);
  const days = input.days ?? DEMO_HISTORY_DAYS;
  const now = input.now;
  const today = warsawDateOf(now);
  const cat = catalogOf(rng, input.products.filter((p) => p.variants.length > 0));
  // Modele bez czesci konfigurowalnych (np. Korek) nie maja konfiguratora w sklepie.
  const models = (input.conf?.models ?? []).filter((m) => m.parts.some((p) => p.konfigurowalna && p.paleta));
  const orders: PlannedOrder[] = [];
  const sessions: PlannedSession[] = [];
  let contactNo = 0;
  let setNo = 0;

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const progress = (days - 1 - i) / Math.max(1, days - 1);
    const { dow } = warsawDowHourOf(new Date(warsawDayStart(date).getTime() + 12 * HOUR));
    const mean = 7 * (0.75 + 0.5 * progress) * (DOW_FACTOR[dow] ?? 1);
    const count = poisson(rng, mean);

    for (let n = 0; n < count; n++) {
      const createdAt = momentIn(rng, date);
      if (createdAt.getTime() > now.getTime() - 10 * MIN) continue;
      const kind = weighted(rng, [
        ["set", 30],
        ["config", 14],
        ["items", 56],
      ] as const);
      const lines: CartLine[] = [];
      let builder: PlannedOrder["builder"] = null;
      let listId: PlannedOrder["listId"] = "polecane";
      if (kind === "set") {
        setNo += 1;
        const fromPreset = input.presets.length > 0 && rng() < 0.45;
        const profile = pick(rng, PROFILES);
        if (fromPreset) {
          const preset = pick(rng, input.presets);
          lines.push({ type: "set", id: `set-demo-${setNo}`, qty: 1, profile: preset.profile, skus: [...preset.skus] });
          builder = rng() < 0.5 ? { entryPoint: "preset", profile: preset.profile } : null;
        } else {
          const skus = (["klawiatury", "myszki", "podkladki"] as const).map(
            (c) => chooseVariant(rng, pickProduct(rng, cat.byCategory[c])).sku,
          );
          lines.push({ type: "set", id: `set-demo-${setNo}`, qty: 1, profile, skus });
          builder = { entryPoint: pick(rng, ENTRY_POINTS), profile };
        }
        listId = "kreator-setu";
      } else if (kind === "config" && input.conf && models.length > 0) {
        const model = weighted(
          rng,
          models.map((m) => [m, m.id.startsWith("k-") ? 4 : m.id.startsWith("m-") ? 3 : 2] as const),
        );
        const cfg = randomConfiguration(rng, input.conf, model);
        const sku = cfg ? configurationSku(input.conf, cfg) : "";
        if (CONFIG_SKU_PATTERN.test(sku)) lines.push({ type: "item", sku, qty: 1 });
        if (rng() < 0.25) {
          const extra = pickProduct(rng, cat.all);
          lines.push({ type: "item", sku: chooseVariant(rng, extra).sku, qty: 1 });
        }
        listId = "polecane";
      } else {
        const nLines = rng() < 0.7 ? 1 : 2;
        const used = new Set<string>();
        for (let l = 0; l < nLines; l++) {
          const product = pickProduct(rng, cat.all);
          const v = chooseVariant(rng, product);
          if (used.has(v.sku)) continue;
          used.add(v.sku);
          lines.push({ type: "item", sku: v.sku, qty: rng() < 0.9 ? 1 : 2 });
          listId = rng() < 0.15 ? "wyszukiwarka" : product.category;
        }
      }
      if (lines.length === 0) continue;

      const shipping = weighted(rng, [
        ["automat", 50],
        ["kurier", 40],
        ["odbior", 10],
      ] as const);
      const hasItems = lines.some((l) => l.type === "item");
      const coupon = hasItems && input.coupons.length > 0 && rng() < 0.09 ? pick(rng, input.coupons) : null;
      const consent = rng() < 0.7;
      const sessionStart = new Date(createdAt.getTime() - between(rng, 6, 45) * MIN);

      // Losy zamowienia: platnosc, realizacja, anulowania (tylko kroki do chwili `now`).
      const fate = rng();
      let failedAt: Date | null = null;
      let paidAt: Date | null = null;
      let cancelledAt: Date | null = null;
      let cancelReason: string | null = null;
      let processingAt: Date | null = null;
      let shippedAt: Date | null = null;
      let deliveredAt: Date | null = null;
      if (fate < 0.045) {
        // porzucone: nieoplacone, po 3 dniach anulowane przez obsluge
        if (rng() < 0.5) failedAt = new Date(createdAt.getTime() + between(rng, 1, 6) * MIN);
        const c = new Date(createdAt.getTime() + between(rng, 72, 100) * HOUR);
        if (c < now) {
          cancelledAt = c;
          cancelReason = "Brak płatności w terminie";
        }
      } else {
        if (fate < 0.12) failedAt = new Date(createdAt.getTime() + between(rng, 1, 5) * MIN);
        paidAt = new Date((failedAt ?? createdAt).getTime() + between(rng, 1, 12) * MIN);
        const stuck = createdAt.getTime() > now.getTime() - 4 * DAY && rng() < 0.12;
        processingAt = nextWorkingMoment(rng, paidAt, stuck ? 28 : 1, stuck ? 60 : 18);
        shippedAt = nextWorkingMoment(rng, processingAt, 3, 26);
        deliveredAt = new Date(shippedAt.getTime() + between(rng, 20, 70) * HOUR);
        if (rng() < 0.035) {
          const at = new Date(paidAt.getTime() + between(rng, 2, 20) * HOUR);
          cancelledAt = at;
          cancelReason = "Rezygnacja klienta przed wysyłką";
          if (processingAt > at) processingAt = null;
          shippedAt = null;
          deliveredAt = null;
        }
      }
      const clip = (d: Date | null): Date | null => (d && d.getTime() <= now.getTime() ? d : null);
      paidAt = clip(paidAt);
      failedAt = clip(failedAt);
      processingAt = paidAt ? clip(processingAt) : null;
      shippedAt = processingAt ? clip(shippedAt) : null;
      deliveredAt = shippedAt ? clip(deliveredAt) : null;

      contactNo += 1;
      orders.push({
        idempotencyKey: demoUuid(rng),
        sessionId: consent ? demoSessionId(rng) : null,
        sessionStart,
        createdAt,
        lines,
        builder,
        listId,
        shipping,
        point: input.pickupPoints.length > 0 ? pick(rng, input.pickupPoints) : "",
        payment: input.payments.length > 0 ? pick(rng, input.payments) : "blik",
        coupon,
        contactNo,
        city: pick(rng, CITIES),
        failedAt,
        paidAt,
        processingAt,
        shippedAt,
        deliveredAt,
        cancelledAt,
        cancelReason,
      });
    }

    // Ruch bez zakupu (sesje ze zgoda na analityke): ok. 25 sesji na jedno zamowienie ze zgoda.
    const browse = poisson(rng, mean * 0.7 * 24);
    for (let s = 0; s < browse; s++) {
      const start = momentIn(rng, date);
      if (start > now) continue;
      sessions.push(browsingSession(rng, cat, start, now));
    }
  }
  orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return { orders, sessions };
}

// ---------------------------------------------------------------- zdarzenia (docs/10, nazwy i parametry bez zmian)

const zl = (gr: number): number => Math.round(gr) / 100;
const LIST_NAME: Record<string, string> = {
  klawiatury: "Klawiatury",
  myszki: "Myszki",
  podkladki: "Podkładki",
  polecane: "Polecane",
  wyszukiwarka: "Wyszukiwarka",
  "kreator-setu": "Kreator setu",
};

export function itemParam(
  p: PlanProduct,
  v: PlanVariant,
  extra: { listId?: string; index?: number; quantity?: number; discountGr?: number; promotion?: string } = {},
): Record<string, unknown> {
  return {
    item_id: v.sku,
    item_name: p.name,
    item_brand: "Taktyl",
    item_category: p.category,
    item_variant: v.label,
    price: zl(v.priceGr),
    quantity: extra.quantity ?? 1,
    discount: zl(extra.discountGr ?? 0),
    ...(extra.promotion ? { promotion_name: extra.promotion } : {}),
    ...(extra.listId ? { item_list_id: extra.listId, item_list_name: LIST_NAME[extra.listId] ?? extra.listId } : {}),
    ...(extra.index !== undefined ? { index: extra.index } : {}),
  };
}

function browsingSession(rng: Rng, cat: Catalog, start: Date, now: Date): PlannedSession {
  const sessionId = demoSessionId(rng);
  const events: PlannedEvent[] = [];
  let t = start.getTime();
  const push = (name: string, params: Record<string, unknown>) => {
    t += Math.floor(between(rng, 8, 140) * 1000);
    if (t <= now.getTime()) events.push({ name, params, ts: new Date(t) });
  };
  const category = pick(rng, ["klawiatury", "myszki", "podkladki"] as const);
  const listView = () => push("view_item_list", { item_list_id: category, item_list_name: LIST_NAME[category] });
  const viewSome = (k: number) => {
    let last: { p: PlanProduct; v: PlanVariant } | null = null;
    for (let i = 0; i < k; i++) {
      const p = pickProduct(rng, cat.byCategory[category]);
      const v = chooseVariant(rng, p);
      if (i === 0) push("select_item", { item_list_id: category, item_list_name: LIST_NAME[category], items: [itemParam(p, v, { listId: category, index: Math.floor(rng() * 8) })] });
      push("view_item", { currency: "PLN", value: zl(v.priceGr), items: [itemParam(p, v)] });
      last = { p, v };
    }
    return last;
  };
  const kind = weighted(rng, [
    ["bounce", 38],
    ["browse", 33],
    ["search", 10],
    ["cart", 9],
    ["checkout", 3],
    ["builder", 5],
    ["other", 2],
  ] as const);
  if (kind === "bounce") {
    if (rng() < 0.5) listView();
    else viewSome(1);
  } else if (kind === "browse") {
    listView();
    if (rng() < 0.35) push("filter_apply", { item_list_id: category, filter_name: "kolor", filter_value: pick(rng, ["grafit", "mgla", "kobalt", "naturalny"]) });
    viewSome(1 + Math.floor(rng() * 3));
  } else if (kind === "search") {
    push("search", { search_term: pick(rng, SEARCH_TERMS) });
    viewSome(1);
  } else if (kind === "cart" || kind === "checkout") {
    listView();
    const last = viewSome(1 + Math.floor(rng() * 2));
    if (last) {
      push("add_to_cart", { currency: "PLN", value: zl(last.v.priceGr), items: [itemParam(last.p, last.v)] });
      push("view_cart", { currency: "PLN", value: zl(last.v.priceGr), items: [itemParam(last.p, last.v)] });
      if (kind === "checkout") {
        push("begin_checkout", { currency: "PLN", value: zl(last.v.priceGr), coupon: "", items: [itemParam(last.p, last.v)] });
        push("add_shipping_info", { currency: "PLN", value: zl(last.v.priceGr), shipping_tier: pick(rng, ["automat", "kurier", "odbior"]), items: [itemParam(last.p, last.v)] });
      } else if (rng() < 0.2) {
        push("remove_from_cart", { currency: "PLN", value: zl(last.v.priceGr), items: [itemParam(last.p, last.v)] });
      }
    }
  } else if (kind === "builder") {
    const profile = pick(rng, PROFILES);
    push("set_builder_start", { entry_point: pick(rng, ENTRY_POINTS) });
    push("set_profile_select", { profile, hand_cm: rng() < 0.4 ? Math.round(between(rng, 17, 21) * 2) / 2 : null });
    const steps = 1 + Math.floor(rng() * 3);
    const chosen: { p: PlanProduct; v: PlanVariant }[] = [];
    (["klawiatury", "myszki", "podkladki"] as const).slice(0, steps).forEach((c) => {
      const p = pickProduct(rng, cat.byCategory[c]);
      const v = chooseVariant(rng, p);
      chosen.push({ p, v });
      push("set_step_complete", { step: c === "klawiatury" ? "klawiatura" : c === "myszki" ? "myszka" : "podkladka", item_id: v.sku, item_name: p.name });
    });
    if (steps === 3) {
      const value = chosen.reduce((s, c) => s + c.v.priceGr, 0);
      push("set_complete", { value: zl(value), discount: zl(Math.round(value * 0.1)), profile, warnings: rng() < 0.2 ? 1 : 0 });
      if (rng() < 0.3) push("set_share", { method: rng() < 0.9 ? "clipboard" : "fallback" });
      if (rng() < 0.2) push("set_save", { value: zl(value) });
    }
  } else {
    const p = pickProduct(rng, cat.all);
    const v = chooseVariant(rng, p);
    push("view_item", { currency: "PLN", value: zl(v.priceGr), items: [itemParam(p, v)] });
    if (rng() < 0.5) push("add_to_wishlist", { currency: "PLN", value: zl(v.priceGr), items: [itemParam(p, v)] });
    else push("compare_add", { item_id: v.sku, compare_count: 1 + Math.floor(rng() * 3) });
    if (rng() < 0.3) push("shortcut_use", { key: pick(rng, ["/", "esc", "?"]) });
  }
  return { sessionId, events };
}
