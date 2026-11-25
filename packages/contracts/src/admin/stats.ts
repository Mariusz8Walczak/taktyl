// B-610..B-627 (docs/15 par. 12, docs/16 par. 3.5, docs/25 par. 2): statystyki pulpitu, ruch z kolektora, operacje,
// kondycja systemu i wyszukiwarka globalna backpanelu. Kwoty w groszach, udzialy w punktach bazowych (1 % = 100 bp),
// czasy w minutach: zadnych liczb zmiennoprzecinkowych w kontrakcie (docs/16 par. 1).
import { z } from "zod";
import { categoryIdSchema, orderStatusSchema } from "../shared/enums";
import { dateSchema, dateTimeSchema } from "../shared/primitives";

const count = z.int().min(0);
const gr = z.int().min(0);

/** Liczba z wartoscia poprzedniego okresu (null = porownanie wylaczone). */
export const statValueSchema = z.object({ value: z.int(), previous: z.int().nullable() });
export type StatValue = z.infer<typeof statValueSchema>;

/** Najdluzszy zakres pulpitu (rok i jeden dzien). */
export const STATS_MAX_DAYS = 366;

/** ?from=RRRR-MM-DD&to=RRRR-MM-DD (dni kalendarzowe w Europe/Warsaw, obustronnie wlacznie); domyslnie 30 dni do dzis. */
export const statsRangeQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  compare: z.enum(["previous", "none"]).default("previous"),
});
export type StatsRangeQuery = z.input<typeof statsRangeQuerySchema>;

export const statsRangeSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  days: z.int().min(1).max(STATS_MAX_DAYS),
  /** okres poprzedni tej samej dlugosci, bezposrednio przed `from` (null, gdy compare=none) */
  previous: z.object({ from: dateSchema, to: dateSchema }).nullable(),
});
export type StatsRange = z.infer<typeof statsRangeSchema>;

/** Jeden dzien wykresu przychodu (B-611); `prev_*` = dzien o tym samym indeksie w okresie poprzednim. */
export const salesDaySchema = z.object({
  date: dateSchema,
  revenue_gr: gr,
  orders: count,
  paid_orders: count,
  set_revenue_gr: gr,
  items_revenue_gr: gr,
  prev_date: dateSchema.nullable(),
  prev_revenue_gr: gr.nullable(),
  prev_orders: count.nullable(),
});

export const statusTransitionSchema = z.object({
  from: orderStatusSchema,
  to: orderStatusSchema,
  count,
  /** mediana czasu przejscia w minutach */
  median_minutes: count,
});

export const salesStatsSchema = z.object({
  generated_at: dateTimeSchema,
  range: statsRangeSchema,
  /** true, gdy w zakresie sa zamowienia z generatora danych demo (B-622) */
  demo_data: z.boolean(),
  /** B-610: przychod oplacony (grosze, wg daty platnosci), zamowienia zlozone, AOV, udzial setow w wartosci pozycji */
  kpi: z.object({
    revenue_gr: statValueSchema,
    orders: statValueSchema,
    paid_orders: statValueSchema,
    aov_gr: statValueSchema,
    set_share_bp: statValueSchema,
  }),
  /** B-611 */
  daily: z.array(salesDaySchema),
  /** B-612: zamowienia zlozone w zakresie; `reached` = ile doszlo co najmniej do statusu (z order_status_history) */
  funnel: z.object({
    created: count,
    reached: z.object({ paid: count, processing: count, shipped: count, delivered: count }),
    cancelled: count,
    payment_failed_once: count,
    waiting_payment: count,
    transitions: z.array(statusTransitionSchema),
  }),
  /** B-613: zamowienia zlozone wg dnia tygodnia (1 = poniedzialek) i godziny w Europe/Warsaw */
  heatmap: z.object({
    cells: z.array(
      z.object({ dow: z.int().min(1).max(7), hour: z.int().min(0).max(23), orders: count }),
    ),
    max: count,
  }),
  /** B-614: sety (pozycje z group_id) w oplaconych zamowieniach */
  sets: z.object({
    paid_orders: count,
    orders_with_set: count,
    sets_sold: count,
    set_revenue_gr: gr,
    single_revenue_gr: gr,
    set_discount_gr: gr,
    prev_set_revenue_gr: gr.nullable(),
    prev_set_discount_gr: gr.nullable(),
  }),
  /** B-615: konfiguracje wlasne 3D (order_items.config_sku) w oplaconych zamowieniach */
  configurator: z.object({
    items: count,
    orders: count,
    revenue_gr: gr,
    surcharge_avg_gr: gr,
    surcharge_total_gr: gr,
    prev_items: count.nullable(),
    by_model: z.array(z.object({ model: z.string(), name: z.string(), items: count })),
    top_colors: z.array(
      z.object({ color: z.string(), label: z.string(), swatch: z.string(), parts: count }),
    ),
  }),
  /** B-616: kolorystyki wariantow seryjnych (bez konfiguracji) w oplaconych zamowieniach */
  colors: z.array(
    z.object({
      color: z.string(),
      label: z.string(),
      swatch: z.string(),
      units: count,
      revenue_gr: gr,
      prev_units: count.nullable(),
    }),
  ),
  /** B-617 */
  top_products: z.array(
    z.object({
      product_id: z.string(),
      slug: z.string(),
      name: z.string(),
      category: categoryIdSchema,
      thumb_url: z.string().nullable(),
      units: count,
      revenue_gr: gr,
      prev_revenue_gr: gr.nullable(),
    }),
  ),
});
export type SalesStats = z.infer<typeof salesStatsSchema>;

/** B-618: operacje - co wymaga reakcji (bez zakresu dat, stan na teraz). */
export const operationsStatsSchema = z.object({
  generated_at: dateTimeSchema,
  waiting_orders: z.object({
    count,
    items: z.array(
      z.object({ number: z.string(), paid_at: dateTimeSchema, total_gr: gr, hours: count }),
    ),
  }),
  low_stock: z.object({
    count,
    out_of_stock: count,
    items: z.array(
      z.object({
        sku: z.string(),
        product_id: z.string(),
        product_name: z.string(),
        stock: count,
        sold_30d: count,
        /** prognoza: stan / (sprzedaz 30 dni / 30), w dniach; null = brak sprzedazy w 30 dniach */
        days_left: count.nullable(),
      }),
    ),
  }),
  messages_unhandled: count,
  outbox: z.object({
    pending: count,
    failed: count,
    last_revalidated_at: dateTimeSchema.nullable(),
  }),
  images: z.object({
    p0_ready: count,
    p0_total: count,
    p1_ready: count,
    p1_total: count,
    ready: count,
    total: count,
  }),
  /** warianty w promocji: cena, cena regularna i najnizsza cena z 30 dni wyliczona z price_history (ADR-0005) */
  omnibus: z.array(
    z.object({
      sku: z.string(),
      product_id: z.string(),
      product_name: z.string(),
      price_gr: gr,
      regular_price_gr: gr.nullable(),
      lowest_30d_gr: gr,
    }),
  ),
});
export type OperationsStats = z.infer<typeof operationsStatsSchema>;

/** B-620: ruch z kolektora zdarzen (B-621). Sesja = anonimowy session_id. */
export const trafficStatsSchema = z.object({
  generated_at: dateTimeSchema,
  range: statsRangeSchema,
  demo_data: z.boolean(),
  kpi: z.object({
    sessions: statValueSchema,
    purchases: statValueSchema,
    conversion_bp: statValueSchema,
    abandoned_carts: statValueSchema,
    events: statValueSchema,
  }),
  /** sesje, ktore wykonaly krok (view_item -> add_to_cart -> begin_checkout -> purchase) */
  funnel: z.array(z.object({ step: z.string(), sessions: count, previous: count.nullable() })),
  daily: z.array(
    z.object({
      date: dateSchema,
      sessions: count,
      purchases: count,
      prev_sessions: count.nullable(),
    }),
  ),
  builder: z.object({
    starts: count,
    completes: count,
    add_to_cart: count,
    entry_points: z.array(z.object({ entry_point: z.string(), count })),
  }),
  top_items: z.array(
    z.object({ item_id: z.string(), item_name: z.string(), views: count, add_to_cart: count }),
  ),
  searches: z.array(z.object({ term: z.string(), count })),
  lists: z.array(z.object({ list: z.string(), views: count })),
});
export type TrafficStats = z.infer<typeof trafficStatsSchema>;

/** B-623: "Jak to jest zrobione" - stos i kondycja uslug. */
export const systemStatusSchema = z.object({
  generated_at: dateTimeSchema,
  demo_mode: z.boolean(),
  services: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      status: z.enum(["ok", "uwaga", "awaria"]),
      detail: z.string(),
      latency_ms: count.nullable(),
    }),
  ),
  stack: z.array(z.object({ name: z.string(), version: z.string(), role: z.string() })),
  data: z.array(z.object({ id: z.string(), label: z.string(), count })),
  migrations: z.object({ applied: count, last: z.string().nullable() }),
});
export type SystemStatus = z.infer<typeof systemStatusSchema>;

/** B-626: wyszukiwarka globalna (paleta polecen). */
export const adminSearchQuerySchema = z.object({ q: z.string().trim().min(1).max(80) });
export const adminSearchSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: categoryIdSchema,
      sku: z.string().nullable(),
      status: z.string(),
    }),
  ),
  orders: z.array(
    z.object({
      number: z.string(),
      status: orderStatusSchema,
      total_gr: gr,
      created_at: dateTimeSchema,
    }),
  ),
});
export type AdminSearch = z.infer<typeof adminSearchSchema>;
