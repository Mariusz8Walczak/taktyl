// B-610..B-618 (docs/25 par. 2, docs/15 par. 12): statystyki sprzedazy i operacji pulpitu. Wylacznie liczby z bazy:
// przychod oplacony wg daty platnosci, zamowienia wg daty zlozenia (Europe/Warsaw), okres poprzedni tej samej dlugosci.
// Doplaty konfiguracji liczy @taktyl/domain (configurationSurcharge), najnizsza cena z 30 dni - PricingService (ADR-0005).
import { Inject, Injectable } from "@nestjs/common";
import {
  operationsStatsSchema,
  salesStatsSchema,
  type CategoryId,
  type OperationsStats,
  type OrderStatus,
  type SalesStats,
} from "@taktyl/contracts";
import { configurationSurcharge, findModel, type ConfData, type Configuration } from "@taktyl/domain";
import { CLOCK, type Clock } from "../common/clock.js";
import { respond } from "../common/zod.pipe.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { ConfiguratorService } from "../configurator/configurator.service.js";
import { slotSpecs } from "../admin-media/media-spec.js";
import { PricingService } from "../pricing/pricing.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  median,
  resolveRange,
  shareBp,
  warsawDateOf,
  warsawDowHourOf,
  type StatsWindow,
} from "./range.js";

const DAY_MS = 86_400_000;
/** Statusy, w ktorych zamowienie jest oplacone (licza sie do przychodu). */
export const PAID_STATUSES: readonly OrderStatus[] = ["paid", "processing", "shipped", "delivered"];
const TRANSITIONS: readonly [OrderStatus, OrderStatus][] = [
  ["pending_payment", "paid"],
  ["paid", "processing"],
  ["processing", "shipped"],
  ["shipped", "delivered"],
];
const TOP_PRODUCTS = 8;
const LOW_STOCK_MAX = 3;
const FORECAST_DAYS_ALERT = 14;
const LIST_MAX = 12;

interface PaidItem {
  number: string;
  paidAt: Date;
  sku: string;
  qty: number;
  unitPriceGr: number;
  setDiscountGr: number;
  couponDiscountGr: number;
  groupId: string | null;
  configSku: string | null;
  config: unknown;
  productId: string;
  colorId: string;
}

const lineValue = (i: PaidItem): number => i.unitPriceGr * i.qty - i.setDiscountGr - i.couponDiscountGr;

@Injectable()
export class SalesStatsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PricingService) private readonly pricing: PricingService,
    @Inject(ConfiguratorService) private readonly configurator: ConfiguratorService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private paidOrders(w: StatsWindow) {
    return this.prisma.order.findMany({
      where: { status: { in: [...PAID_STATUSES] }, paidAt: { gte: w.start, lt: w.end } },
      select: { number: true, paidAt: true, totalGr: true, setDiscountGr: true, demo: true },
    });
  }

  private async paidItems(w: StatsWindow): Promise<PaidItem[]> {
    const rows = await this.prisma.orderItem.findMany({
      where: { order: { status: { in: [...PAID_STATUSES] }, paidAt: { gte: w.start, lt: w.end } } },
      select: {
        orderNumber: true,
        sku: true,
        qty: true,
        unitPriceGr: true,
        setDiscountGr: true,
        couponDiscountGr: true,
        groupId: true,
        configSku: true,
        config: true,
        order: { select: { paidAt: true } },
        variant: { select: { productId: true, colorId: true } },
      },
    });
    return rows.map((r) => ({
      number: r.orderNumber,
      paidAt: r.order.paidAt as Date,
      sku: r.sku,
      qty: r.qty,
      unitPriceGr: r.unitPriceGr,
      setDiscountGr: r.setDiscountGr,
      couponDiscountGr: r.couponDiscountGr,
      groupId: r.groupId,
      configSku: r.configSku,
      config: r.config,
      productId: r.variant.productId,
      colorId: r.variant.colorId,
    }));
  }

  private createdOrders(w: StatsWindow) {
    return this.prisma.order.findMany({
      where: { createdAt: { gte: w.start, lt: w.end } },
      select: {
        number: true,
        status: true,
        createdAt: true,
        demo: true,
        statusHistory: { select: { toStatus: true, at: true }, orderBy: { at: "asc" } },
      },
    });
  }

  /** B-610..B-617: sprzedaz w zakresie z porownaniem do okresu poprzedniego. */
  async sales(query: { from?: string; to?: string; compare: "previous" | "none" }): Promise<SalesStats> {
    const now = this.clock();
    const { current, previous, range } = resolveRange(query, now);
    const [paid, items, created, prevPaid, prevItems, prevCreatedCount, conf] = await Promise.all([
      this.paidOrders(current),
      this.paidItems(current),
      this.createdOrders(current),
      previous ? this.paidOrders(previous) : Promise.resolve(null),
      previous ? this.paidItems(previous) : Promise.resolve(null),
      previous
        ? this.prisma.order.count({ where: { createdAt: { gte: previous.start, lt: previous.end } } })
        : Promise.resolve(null),
      this.configurator.confData(),
    ]);

    // --- B-610 KPI
    const revenue = paid.reduce((s, o) => s + o.totalGr, 0);
    const prevRevenue = prevPaid ? prevPaid.reduce((s, o) => s + o.totalGr, 0) : null;
    const aov = paid.length > 0 ? Math.round(revenue / paid.length) : 0;
    const prevAov =
      prevPaid && prevRevenue !== null ? (prevPaid.length > 0 ? Math.round(prevRevenue / prevPaid.length) : 0) : null;
    const setShare = (list: PaidItem[]): number =>
      shareBp(
        list.filter((i) => i.groupId !== null).reduce((s, i) => s + lineValue(i), 0),
        list.reduce((s, i) => s + lineValue(i), 0),
      );

    // --- B-611 dzien po dniu
    const byDay = new Map<string, { revenue: number; orders: number; paid: number; set: number; items: number }>();
    const day = (d: string) => {
      let v = byDay.get(d);
      if (!v) {
        v = { revenue: 0, orders: 0, paid: 0, set: 0, items: 0 };
        byDay.set(d, v);
      }
      return v;
    };
    for (const o of paid) {
      const v = day(warsawDateOf(o.paidAt as Date));
      v.revenue += o.totalGr;
      v.paid += 1;
    }
    for (const o of created) day(warsawDateOf(o.createdAt)).orders += 1;
    for (const i of items) {
      const v = day(warsawDateOf(i.paidAt));
      v.items += lineValue(i);
      if (i.groupId !== null) v.set += lineValue(i);
    }
    const prevByDay = new Map<string, { revenue: number; orders: number }>();
    if (previous && prevPaid) {
      for (const o of prevPaid) {
        const d = warsawDateOf(o.paidAt as Date);
        const v = prevByDay.get(d) ?? { revenue: 0, orders: 0 };
        v.revenue += o.totalGr;
        prevByDay.set(d, v);
      }
      const prevCreated = await this.prisma.order.findMany({
        where: { createdAt: { gte: previous.start, lt: previous.end } },
        select: { createdAt: true },
      });
      for (const o of prevCreated) {
        const d = warsawDateOf(o.createdAt);
        const v = prevByDay.get(d) ?? { revenue: 0, orders: 0 };
        v.orders += 1;
        prevByDay.set(d, v);
      }
    }
    const daily = current.days.map((d, idx) => {
      const v = byDay.get(d);
      const pd = previous ? (previous.days[idx] ?? null) : null;
      const pv = pd ? prevByDay.get(pd) : undefined;
      return {
        date: d,
        revenue_gr: v?.revenue ?? 0,
        orders: v?.orders ?? 0,
        paid_orders: v?.paid ?? 0,
        set_revenue_gr: v?.set ?? 0,
        items_revenue_gr: v?.items ?? 0,
        prev_date: pd,
        prev_revenue_gr: pd ? (pv?.revenue ?? 0) : null,
        prev_orders: pd ? (pv?.orders ?? 0) : null,
      };
    });

    // --- B-612 lejek statusow i czasy przejsc
    const reached = { paid: 0, processing: 0, shipped: 0, delivered: 0 };
    let cancelled = 0;
    let failedOnce = 0;
    let waiting = 0;
    const durations = new Map<string, number[]>();
    for (const o of created) {
      const first = new Map<string, Date>();
      for (const h of o.statusHistory) if (!first.has(h.toStatus)) first.set(h.toStatus, h.at);
      for (const k of ["paid", "processing", "shipped", "delivered"] as const) if (first.has(k)) reached[k] += 1;
      if (o.status === "cancelled") cancelled += 1;
      if (o.status === "pending_payment" || o.status === "payment_failed") waiting += 1;
      if (first.has("payment_failed")) failedOnce += 1;
      for (const [from, to] of TRANSITIONS) {
        const a = first.get(from);
        const b = first.get(to);
        if (a && b && b >= a) {
          const key = `${from}>${to}`;
          const list = durations.get(key) ?? [];
          list.push(Math.round((b.getTime() - a.getTime()) / 60_000));
          durations.set(key, list);
        }
      }
    }
    const transitions = TRANSITIONS.map(([from, to]) => {
      const list = durations.get(`${from}>${to}`) ?? [];
      return { from, to, count: list.length, median_minutes: median(list) };
    });

    // --- B-613 mapa cieplna
    const heat = new Map<string, number>();
    for (const o of created) {
      const { dow, hour } = warsawDowHourOf(o.createdAt);
      heat.set(`${dow}:${hour}`, (heat.get(`${dow}:${hour}`) ?? 0) + 1);
    }
    const cells = [];
    let heatMax = 0;
    for (let dow = 1; dow <= 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        const n = heat.get(`${dow}:${hour}`) ?? 0;
        heatMax = Math.max(heatMax, n);
        cells.push({ dow, hour, orders: n });
      }
    }

    // --- B-614 sety
    const setsOf = (list: PaidItem[]) => {
      const groups = new Map<string, number>();
      let setRev = 0;
      let singleRev = 0;
      let disc = 0;
      const withSet = new Set<string>();
      for (const i of list) {
        disc += i.setDiscountGr;
        if (i.groupId !== null) {
          setRev += lineValue(i);
          withSet.add(i.number);
          groups.set(`${i.number}:${i.groupId}`, i.qty);
        } else singleRev += lineValue(i);
      }
      const sold = [...groups.values()].reduce((s, q) => s + q, 0);
      return { setRev, singleRev, disc, withSet: withSet.size, sold };
    };
    const s = setsOf(items);
    const ps = prevItems ? setsOf(prevItems) : null;

    // --- B-615 konfiguracje 3D
    const cfg = this.configStats(conf, items, prevItems);

    // --- B-616 kolory i B-617 top produkty
    const [colors, top] = await Promise.all([this.colorRanking(items, prevItems), this.topProducts(items, prevItems)]);

    return respond(salesStatsSchema, {
      generated_at: now.toISOString(),
      range,
      demo_data: paid.some((o) => o.demo) || created.some((o) => o.demo),
      kpi: {
        revenue_gr: { value: revenue, previous: prevRevenue },
        orders: { value: created.length, previous: prevCreatedCount },
        paid_orders: { value: paid.length, previous: prevPaid ? prevPaid.length : null },
        aov_gr: { value: aov, previous: prevAov },
        set_share_bp: { value: setShare(items), previous: prevItems ? setShare(prevItems) : null },
      },
      daily,
      funnel: {
        created: created.length,
        reached,
        cancelled,
        payment_failed_once: failedOnce,
        waiting_payment: waiting,
        transitions,
      },
      heatmap: { cells, max: heatMax },
      sets: {
        paid_orders: paid.length,
        orders_with_set: s.withSet,
        sets_sold: s.sold,
        set_revenue_gr: s.setRev,
        single_revenue_gr: s.singleRev,
        set_discount_gr: s.disc,
        prev_set_revenue_gr: ps ? ps.setRev : null,
        prev_set_discount_gr: ps ? ps.disc : null,
      },
      configurator: cfg,
      colors,
      top_products: top,
    });
  }

  private configStats(d: ConfData, items: PaidItem[], prev: PaidItem[] | null): SalesStats["configurator"] {
    const cfgItems = items.filter((i) => i.configSku !== null);
    const byModel = new Map<string, number>();
    const colorCount = new Map<string, number>();
    let surchargeTotal = 0;
    let units = 0;
    for (const i of cfgItems) {
      const c = i.config as Configuration | null;
      if (!c || typeof c !== "object" || typeof c.model !== "string") continue;
      units += i.qty;
      byModel.set(c.model, (byModel.get(c.model) ?? 0) + i.qty);
      try {
        surchargeTotal += configurationSurcharge(d, c) * i.qty;
      } catch {
        // model usuniety ze slownika: pozycja liczy sie do sztuk, bez doplaty
      }
      for (const part of Object.values(c.parts ?? {})) {
        if (part && typeof part.color === "string" && part.color !== "auto")
          colorCount.set(part.color, (colorCount.get(part.color) ?? 0) + i.qty);
      }
    }
    return {
      items: units,
      orders: new Set(cfgItems.map((i) => i.number)).size,
      revenue_gr: cfgItems.reduce((s, i) => s + lineValue(i), 0),
      surcharge_total_gr: surchargeTotal,
      surcharge_avg_gr: units > 0 ? Math.round(surchargeTotal / units) : 0,
      prev_items: prev ? prev.filter((i) => i.configSku !== null).reduce((s, i) => s + i.qty, 0) : null,
      by_model: [...byModel.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([model, n]) => {
          const m = findModel(d, model);
          return { model, name: m ? `${m.name}${m.size ? ` ${m.size.toUpperCase()}` : ""}` : model, items: n };
        }),
      top_colors: [...colorCount.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([color, parts]) => ({
          color,
          label: d.colors[color]?.label ?? color,
          swatch: d.colors[color]?.swatch ?? "",
          parts,
        })),
    };
  }

  private async colorRanking(items: PaidItem[], prev: PaidItem[] | null): Promise<SalesStats["colors"]> {
    const agg = new Map<string, { units: number; revenue: number }>();
    for (const i of items) {
      if (i.configSku !== null) continue;
      const v = agg.get(i.colorId) ?? { units: 0, revenue: 0 };
      v.units += i.qty;
      v.revenue += lineValue(i);
      agg.set(i.colorId, v);
    }
    const prevUnits = new Map<string, number>();
    for (const i of prev ?? []) {
      if (i.configSku === null) prevUnits.set(i.colorId, (prevUnits.get(i.colorId) ?? 0) + i.qty);
    }
    const colors = await this.prisma.color.findMany({
      where: { id: { in: [...agg.keys()] } },
      select: { id: true, label: true, swatch: true },
    });
    const meta = new Map(colors.map((c) => [c.id, c]));
    return [...agg.entries()]
      .sort((a, b) => b[1].units - a[1].units || b[1].revenue - a[1].revenue || a[0].localeCompare(b[0]))
      .slice(0, LIST_MAX)
      .map(([id, v]) => ({
        color: id,
        label: meta.get(id)?.label ?? id,
        swatch: meta.get(id)?.swatch ?? "",
        units: v.units,
        revenue_gr: v.revenue,
        prev_units: prev ? (prevUnits.get(id) ?? 0) : null,
      }));
  }

  private async topProducts(items: PaidItem[], prev: PaidItem[] | null): Promise<SalesStats["top_products"]> {
    const agg = new Map<string, { units: number; revenue: number }>();
    for (const i of items) {
      const v = agg.get(i.productId) ?? { units: 0, revenue: 0 };
      v.units += i.qty;
      v.revenue += lineValue(i);
      agg.set(i.productId, v);
    }
    const prevRev = new Map<string, number>();
    for (const i of prev ?? []) prevRev.set(i.productId, (prevRev.get(i.productId) ?? 0) + lineValue(i));
    const ids = [...agg.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue || a[0].localeCompare(b[0]))
      .slice(0, TOP_PRODUCTS)
      .map(([id]) => id);
    const [products, images] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, slug: true, name: true, categoryId: true, defaultVariant: { select: { colorId: true } } },
      }),
      this.prisma.productImage.findMany({
        where: { productId: { in: ids }, kind: "packshot", status: "gotowe" },
        select: { productId: true, colorId: true, kind: true, files: true, pixels: true, key: true },
        orderBy: { key: "asc" },
      }),
    ]);
    const meta = new Map(products.map((p) => [p.id, p]));
    const thumb = (productId: string): string | null => {
      const color = meta.get(productId)?.defaultVariant?.colorId;
      const candidates = images.filter((im) => im.productId === productId);
      const img = candidates.find((im) => im.colorId === color) ?? candidates[0];
      if (!img) return null;
      const slot = slotSpecs(img).sort((a, b) => a.width - b.width)[0];
      return slot ? `${this.config.MEDIA_PUBLIC_URL.replace(/\/+$/, "")}/${slot.path}` : null;
    };
    return ids.map((id) => {
      const p = meta.get(id);
      const v = agg.get(id) as { units: number; revenue: number };
      return {
        product_id: id,
        slug: p?.slug ?? id,
        name: p?.name ?? id,
        category: (p?.categoryId ?? "klawiatury") as CategoryId,
        thumb_url: thumb(id),
        units: v.units,
        revenue_gr: v.revenue,
        prev_revenue_gr: prev ? (prevRev.get(id) ?? 0) : null,
      };
    });
  }

  /** B-618: co wymaga reakcji teraz (bez zakresu dat). */
  async operations(): Promise<OperationsStats> {
    const now = this.clock();
    const h24 = new Date(now.getTime() - DAY_MS);
    const d30 = new Date(now.getTime() - 30 * DAY_MS);
    const [waitingCount, waitingRows, variants, sold, messages, pending, failed, lastSent, images, promo] =
      await Promise.all([
        this.prisma.order.count({ where: { status: "paid", paidAt: { lt: h24 } } }),
        this.prisma.order.findMany({
          where: { status: "paid", paidAt: { lt: h24 } },
          orderBy: { paidAt: "asc" },
          take: LIST_MAX,
          select: { number: true, paidAt: true, totalGr: true },
        }),
        this.prisma.variant.findMany({
          where: { status: "active", product: { status: "active" } },
          select: { sku: true, stock: true, product: { select: { id: true, name: true } } },
        }),
        this.prisma.orderItem.groupBy({
          by: ["sku"],
          where: { configSku: null, order: { status: { in: [...PAID_STATUSES] }, paidAt: { gte: d30 } } },
          _sum: { qty: true },
        }),
        this.prisma.contactMessage.count({ where: { handled: false } }),
        this.prisma.outbox.count({ where: { status: "pending" } }),
        this.prisma.outbox.count({ where: { status: "failed" } }),
        this.prisma.outbox.findFirst({
          where: { status: "sent", sentAt: { not: null } },
          orderBy: { sentAt: "desc" },
          select: { sentAt: true },
        }),
        this.prisma.productImage.groupBy({ by: ["priority", "status"], _count: { _all: true } }),
        this.prisma.variant.findMany({
          where: { status: "active", regularPriceGr: { not: null }, product: { status: "active" } },
          select: { sku: true, priceGr: true, regularPriceGr: true, product: { select: { id: true, name: true } } },
          orderBy: { sku: "asc" },
        }),
      ]);

    const soldBySku = new Map(sold.map((r) => [r.sku, r._sum.qty ?? 0]));
    const forecast = variants
      .map((v) => {
        const s30 = soldBySku.get(v.sku) ?? 0;
        const daysLeft = s30 > 0 ? Math.floor((v.stock * 30) / s30) : null;
        return {
          sku: v.sku,
          product_id: v.product.id,
          product_name: v.product.name,
          stock: v.stock,
          sold_30d: s30,
          days_left: daysLeft,
        };
      })
      .filter((v) => v.stock <= LOW_STOCK_MAX || (v.days_left !== null && v.days_left <= FORECAST_DAYS_ALERT))
      .sort(
        (a, b) =>
          (a.days_left ?? Number.MAX_SAFE_INTEGER) - (b.days_left ?? Number.MAX_SAFE_INTEGER) ||
          a.stock - b.stock ||
          a.sku.localeCompare(b.sku),
      );

    const img = { p0_ready: 0, p0_total: 0, p1_ready: 0, p1_total: 0, ready: 0, total: 0 };
    for (const g of images) {
      const n = g._count._all;
      img.total += n;
      if (g.status === "gotowe") img.ready += n;
      if (g.priority === "P0") {
        img.p0_total += n;
        if (g.status === "gotowe") img.p0_ready += n;
      }
      if (g.priority === "P1") {
        img.p1_total += n;
        if (g.status === "gotowe") img.p1_ready += n;
      }
    }

    const lowest = await this.pricing.lowest30dBySku(
      now,
      promo.map((p) => p.sku),
    );
    const omnibus = promo
      .filter((p) => lowest.has(p.sku))
      .slice(0, LIST_MAX)
      .map((p) => ({
        sku: p.sku,
        product_id: p.product.id,
        product_name: p.product.name,
        price_gr: p.priceGr,
        regular_price_gr: p.regularPriceGr,
        lowest_30d_gr: lowest.get(p.sku) as number,
      }));

    return respond(operationsStatsSchema, {
      generated_at: now.toISOString(),
      waiting_orders: {
        count: waitingCount,
        items: waitingRows.map((o) => ({
          number: o.number,
          paid_at: (o.paidAt as Date).toISOString(),
          total_gr: o.totalGr,
          hours: Math.floor((now.getTime() - (o.paidAt as Date).getTime()) / 3_600_000),
        })),
      },
      low_stock: {
        count: forecast.length,
        out_of_stock: forecast.filter((v) => v.stock === 0).length,
        items: forecast.slice(0, LIST_MAX),
      },
      messages_unhandled: messages,
      outbox: { pending, failed, last_revalidated_at: lastSent?.sentAt?.toISOString() ?? null },
      images: img,
      omnibus,
    });
  }
}
