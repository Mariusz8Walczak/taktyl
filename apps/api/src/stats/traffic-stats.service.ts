// B-620 (ADR-0012, docs/25 par. 2): ruch z kolektora zdarzen docs/10. Sesja = anonimowy session_id; lejek liczy sesje,
// ktore wykonaly krok (view_item -> add_to_cart -> begin_checkout -> purchase); porzucony koszyk = add_to_cart bez purchase.
// Agregacja w SQL (dziesiatki tysiecy zdarzen), dni w Europe/Warsaw.
import { Inject, Injectable } from "@nestjs/common";
import { trafficStatsSchema, type TrafficStats } from "@taktyl/contracts";
import { CLOCK, type Clock } from "../common/clock.js";
import { respond } from "../common/zod.pipe.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { resolveRange, shareBp, type StatsWindow } from "./range.js";

export const FUNNEL_STEPS = ["view_item", "add_to_cart", "begin_checkout", "purchase"] as const;
const LIST_MAX = 10;

interface Totals {
  sessions: number;
  events: number;
  view_item: number;
  add_to_cart: number;
  begin_checkout: number;
  purchase: number;
  purchases: number;
  abandoned: number;
}

@Injectable()
export class TrafficStatsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async totals(w: StatsWindow): Promise<Totals> {
    const rows = await this.prisma.$queryRaw<Totals[]>`
      WITH s AS (
        SELECT session_id,
               count(*)::int AS events,
               bool_or(name = 'view_item') AS vi,
               bool_or(name = 'add_to_cart') AS atc,
               bool_or(name = 'begin_checkout') AS bc,
               bool_or(name = 'purchase') AS pu
          FROM analytics_events
         WHERE ts >= ${w.start} AND ts < ${w.end}
         GROUP BY session_id)
      SELECT count(*)::int AS sessions,
             coalesce(sum(events), 0)::int AS events,
             count(*) FILTER (WHERE vi)::int AS view_item,
             count(*) FILTER (WHERE atc)::int AS add_to_cart,
             count(*) FILTER (WHERE bc)::int AS begin_checkout,
             count(*) FILTER (WHERE pu)::int AS purchase,
             (SELECT count(DISTINCT coalesce(params->>'transaction_id', id::text))::int FROM analytics_events
               WHERE name = 'purchase' AND ts >= ${w.start} AND ts < ${w.end}) AS purchases,
             count(*) FILTER (WHERE atc AND NOT pu)::int AS abandoned
        FROM s`;
    return (
      rows[0] ?? {
        sessions: 0,
        events: 0,
        view_item: 0,
        add_to_cart: 0,
        begin_checkout: 0,
        purchase: 0,
        purchases: 0,
        abandoned: 0,
      }
    );
  }

  private async daily(
    w: StatsWindow,
  ): Promise<Map<string, { sessions: number; purchases: number }>> {
    const rows = await this.prisma.$queryRaw<{ d: string; sessions: number; purchases: number }[]>`
      SELECT to_char(ts AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS d,
             count(DISTINCT session_id)::int AS sessions,
             count(*) FILTER (WHERE name = 'purchase')::int AS purchases
        FROM analytics_events
       WHERE ts >= ${w.start} AND ts < ${w.end}
       GROUP BY 1`;
    return new Map(rows.map((r) => [r.d, { sessions: r.sessions, purchases: r.purchases }]));
  }

  async traffic(query: {
    from?: string;
    to?: string;
    compare: "previous" | "none";
  }): Promise<TrafficStats> {
    const now = this.clock();
    const { current: w, previous: p, range } = resolveRange(query, now);
    const [cur, prev, days, prevDays, builder, entries, items, carts, searches, lists, demo] =
      await Promise.all([
        this.totals(w),
        p ? this.totals(p) : Promise.resolve(null),
        this.daily(w),
        p ? this.daily(p) : Promise.resolve(null),
        this.prisma.$queryRaw<{ name: string; n: number }[]>`
        SELECT name, count(*)::int AS n FROM analytics_events
         WHERE ts >= ${w.start} AND ts < ${w.end}
           AND name IN ('set_builder_start', 'set_complete', 'set_add_to_cart')
         GROUP BY name`,
        this.prisma.$queryRaw<{ entry_point: string; n: number }[]>`
        SELECT coalesce(params->>'entry_point', 'brak') AS entry_point, count(*)::int AS n FROM analytics_events
         WHERE ts >= ${w.start} AND ts < ${w.end} AND name = 'set_builder_start'
         GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT ${LIST_MAX}`,
        this.prisma.$queryRaw<{ item_id: string; item_name: string; n: number }[]>`
        SELECT it->>'item_id' AS item_id, max(it->>'item_name') AS item_name, count(*)::int AS n
          FROM analytics_events e, jsonb_array_elements(coalesce(e.params->'items', '[]'::jsonb)) it
         WHERE e.ts >= ${w.start} AND e.ts < ${w.end} AND e.name = 'view_item' AND it->>'item_id' IS NOT NULL
         GROUP BY 1 ORDER BY 3 DESC, 1 LIMIT ${LIST_MAX}`,
        this.prisma.$queryRaw<{ item_id: string; n: number }[]>`
        SELECT it->>'item_id' AS item_id, count(*)::int AS n
          FROM analytics_events e, jsonb_array_elements(coalesce(e.params->'items', '[]'::jsonb)) it
         WHERE e.ts >= ${w.start} AND e.ts < ${w.end} AND e.name = 'add_to_cart' AND it->>'item_id' IS NOT NULL
         GROUP BY 1`,
        this.prisma.$queryRaw<{ term: string; n: number }[]>`
        SELECT lower(trim(params->>'search_term')) AS term, count(*)::int AS n FROM analytics_events
         WHERE ts >= ${w.start} AND ts < ${w.end} AND name = 'search' AND coalesce(params->>'search_term', '') <> ''
         GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT ${LIST_MAX}`,
        this.prisma.$queryRaw<{ list: string; n: number }[]>`
        SELECT coalesce(params->>'item_list_name', params->>'item_list_id', 'brak') AS list, count(*)::int AS n
          FROM analytics_events
         WHERE ts >= ${w.start} AND ts < ${w.end} AND name = 'view_item_list'
         GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT ${LIST_MAX}`,
        this.prisma.analyticsEvent.findFirst({
          where: { ts: { gte: w.start, lt: w.end }, demo: true },
          select: { id: true },
        }),
      ]);
    const builderCount = (n: string): number => builder.find((b) => b.name === n)?.n ?? 0;
    const atc = new Map(carts.map((c) => [c.item_id, c.n]));
    return respond(trafficStatsSchema, {
      generated_at: now.toISOString(),
      range,
      demo_data: demo !== null,
      kpi: {
        sessions: { value: cur.sessions, previous: prev ? prev.sessions : null },
        purchases: { value: cur.purchases, previous: prev ? prev.purchases : null },
        conversion_bp: {
          value: shareBp(cur.purchase, cur.sessions),
          previous: prev ? shareBp(prev.purchase, prev.sessions) : null,
        },
        abandoned_carts: { value: cur.abandoned, previous: prev ? prev.abandoned : null },
        events: { value: cur.events, previous: prev ? prev.events : null },
      },
      funnel: FUNNEL_STEPS.map((step) => ({
        step,
        sessions: cur[step],
        previous: prev ? prev[step] : null,
      })),
      daily: w.days.map((d, i) => {
        const pd = p?.days[i];
        return {
          date: d,
          sessions: days.get(d)?.sessions ?? 0,
          purchases: days.get(d)?.purchases ?? 0,
          prev_sessions: prevDays && pd ? (prevDays.get(pd)?.sessions ?? 0) : null,
        };
      }),
      builder: {
        starts: builderCount("set_builder_start"),
        completes: builderCount("set_complete"),
        add_to_cart: builderCount("set_add_to_cart"),
        entry_points: entries.map((e) => ({ entry_point: e.entry_point, count: e.n })),
      },
      top_items: items.map((i) => ({
        item_id: i.item_id,
        item_name: i.item_name ?? i.item_id,
        views: i.n,
        add_to_cart: atc.get(i.item_id) ?? 0,
      })),
      searches: searches.map((s) => ({ term: s.term, count: s.n })),
      lists: lists.map((l) => ({ list: l.list, views: l.n })),
    });
  }
}
