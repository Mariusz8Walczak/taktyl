// B-622 (docs/25 par. 5, ADR-0012): wykonawca historii demonstracyjnej. Zamowienia przechodza przez PRAWDZIWA logike:
// wycena koszyka (CartQuoteService + @taktyl/domain), utworzenie zamowienia (OrdersService), symulacja platnosci
// (PaymentsSimService, ruch magazynowy `sale`) i zmiany statusu (AdminOrdersService, maszyna stanow, zwrot stanow).
// Uslugi dostaja wlasny zegar ustawiany na chwile z planu, wiec daty w bazie sa wsteczne i spojne.
// Stany magazynowe: brak towaru w przeszlosci uzupelnia ruch `adjustment` ("Dostawa (dane demo)"), a na koniec stany wracaja
// do wartosci sprzed generatora (inwentaryzacja), wiec pulpit i sklep pokazuja stany z seeda. Zamowienia maja `demo = true`,
// zdarzenia pomiaru `demo = true`. Dziennik zmian dostaje jeden wpis `demo.history` (bez setek wpisow o statusach).
import "reflect-metadata";
import type { OrderRequest } from "@taktyl/contracts";
import { AuditService, type AuditContext } from "../audit/audit.service.js";
import { CartQuoteService, type QuoteComputation } from "../cart-quote/cart-quote.service.js";
import { CatalogLoader, type CatalogSnapshot } from "../catalog/catalog.loader.js";
import type { Clock } from "../common/clock.js";
import type { AppConfig } from "../config/env.js";
import { ConfiguratorService } from "../configurator/configurator.service.js";
import { AdminOrdersService } from "../admin-orders/admin-orders.service.js";
import { OrderAccessService } from "../orders/order-access.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { PaymentsSimService } from "../payments-sim/payments-sim.service.js";
import { PricingService } from "../pricing/pricing.service.js";
import type { Prisma, PrismaClient } from "../prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { ShopConfigService } from "../settings/shop-config.service.js";
import {
  DEMO_HISTORY_SEED,
  itemParam,
  mulberry32,
  planDemoHistory,
  type PlanPreset,
  type PlanProduct,
  type PlannedEvent,
  type PlannedOrder,
} from "./plan.js";

const MIN = 60_000;
const RESTOCK_QTY = 25;
const EVENTS_CHUNK = 2000;

/** Outbox bez zapisu: historia nie zmienia stanu sklepu na koniec (stany wracaja), wiec nie rewaliduje setek znacznikow. */
class SilentOutbox extends OutboxService {
  override enqueueTags(): Promise<void> {
    return Promise.resolve();
  }
}
/** Audyt bez wpisow per zmiana statusu; generator zapisuje jeden wpis `demo.history` na koniec. */
class SilentAudit extends AuditService {
  override record(): Promise<bigint> {
    return Promise.resolve(0n);
  }
}
/** Migawka katalogu z jednego odczytu; stan wariantow zawyzony, bo realny stan sprawdza (i zdejmuje) platnosc. */
class CachedLoader extends CatalogLoader {
  private snap: CatalogSnapshot | null = null;
  override async load(): Promise<CatalogSnapshot> {
    if (!this.snap) {
      const s = await super.load();
      for (const p of s.products) for (const v of p.variants) v.stock = 1000;
      this.snap = s;
    }
    return this.snap;
  }
}

export interface DemoHistoryOptions {
  now: Date;
  config: AppConfig;
  seed?: number;
  days?: number;
  log?: (msg: string) => void;
}

export interface DemoHistoryReport {
  orders: number;
  skipped: number;
  sessions: number;
  events: number;
  restocks: number;
  ms: number;
}

const SYSTEM: AuditContext = { actorId: null, actorRole: "system", requestId: "demo-history", ipHash: null };

type Step =
  | { at: Date; kind: "create"; o: PlannedOrder }
  | { at: Date; kind: "fail"; o: PlannedOrder }
  | { at: Date; kind: "pay"; o: PlannedOrder }
  | { at: Date; kind: "processing" | "shipped" | "delivered"; o: PlannedOrder }
  | { at: Date; kind: "cancel"; o: PlannedOrder };

const zl = (gr: number): number => Math.round(gr) / 100;

export async function generateDemoHistory(client: PrismaClient, opts: DemoHistoryOptions): Promise<DemoHistoryReport> {
  const t0 = Date.now();
  const log = opts.log ?? (() => undefined);
  const prisma = client as unknown as PrismaService;
  const cursor = { at: opts.now };
  const clock: Clock = () => cursor.at;

  const pricing = new PricingService(prisma);
  const loader = new CachedLoader(prisma, pricing, clock);
  const shop = new ShopConfigService(prisma);
  const configurator = new ConfiguratorService(loader, shop, clock);
  const quotes = new CartQuoteService(loader, shop, clock, configurator);
  const access = new OrderAccessService(prisma, opts.config, clock);
  const orders = new OrdersService(prisma, quotes, access, opts.config, clock);
  orders.orderNumberRandom = mulberry32((opts.seed ?? DEMO_HISTORY_SEED) + 7);
  const outbox = new SilentOutbox(clock);
  const payments = new PaymentsSimService(prisma, access, outbox, clock);
  const admin = new AdminOrdersService(prisma, new SilentAudit(prisma, clock), outbox, clock);

  // --- wejscie planu: wylacznie dane z bazy
  const snap = await loader.load();
  const shopConfig = await shop.load(opts.now);
  const [presetRows, points, payTypes, conf] = await Promise.all([
    client.preset.findMany({
      orderBy: { position: "asc" },
      include: { items: { include: { variant: { select: { product: { select: { categoryId: true } } } } } } },
    }),
    client.pickupPoint.findMany({ where: { active: true }, select: { id: true }, orderBy: { id: "asc" } }),
    client.paymentMethod.findMany({ where: { active: true }, select: { id: true }, orderBy: { position: "asc" } }),
    configurator.confData(snap),
  ]);
  const label = (p: CatalogSnapshot["products"][number], v: CatalogSnapshot["products"][number]["variants"][number]) => {
    const parts = [snap.colors[v.color]?.label ?? v.color];
    if (v.switch !== undefined) parts.push(snap.switches.find((s) => s.id === v.switch)?.name ?? v.switch);
    if (v.size !== undefined) parts.push(p.attributes.sizes?.[v.size]?.label ?? v.size.toUpperCase());
    return parts.join(" / ");
  };
  const products: PlanProduct[] = snap.products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    variants: p.variants.map((v) => ({ sku: v.sku, color: v.color, priceGr: v.price, label: label(p, v) })),
  }));
  const order = ["klawiatury", "myszki", "podkladki"];
  const presets: PlanPreset[] = presetRows
    .filter((p) => p.items.length === 3)
    .map((p) => ({
      id: p.id,
      name: p.name,
      profile: p.profile as PlanPreset["profile"],
      skus: [...p.items]
        .sort((a, b) => order.indexOf(a.variant.product.categoryId) - order.indexOf(b.variant.product.categoryId))
        .map((i) => i.sku) as [string, string, string],
    }));
  const plan = planDemoHistory({
    now: opts.now,
    ...(opts.days !== undefined ? { days: opts.days } : {}),
    seed: opts.seed ?? DEMO_HISTORY_SEED,
    products,
    presets,
    pickupPoints: points.map((p) => p.id),
    payments: payTypes.map((p) => p.id),
    shipping: shopConfig.shippingMethods.map((m) => m.id),
    coupons: shopConfig.codes.filter((c) => c.type !== "free_shipping").map((c) => c.code),
    conf,
  });
  log(`historia demo: plan ${plan.orders.length} zamowien, ${plan.sessions.length} sesji bez zakupu`);

  // --- stany sprzed generatora (wracaja na koniec)
  const initial = new Map(
    (await client.variant.findMany({ select: { sku: true, stock: true } })).map((v) => [v.sku, v.stock]),
  );
  let restocks = 0;
  const ensureStock = async (lines: PlannedOrder["lines"]) => {
    const need = new Map<string, number>();
    for (const l of lines) {
      const skus = l.type === "set" ? l.skus : [l.sku];
      for (const s of skus) if (!s.includes("-CFG-")) need.set(s, (need.get(s) ?? 0) + l.qty);
    }
    if (need.size === 0) return;
    const rows = await client.variant.findMany({ where: { sku: { in: [...need.keys()] } }, select: { sku: true, stock: true } });
    for (const r of rows) {
      const want = need.get(r.sku) as number;
      if (r.stock >= want) continue;
      const add = RESTOCK_QTY + want;
      await client.$transaction([
        client.variant.update({ where: { sku: r.sku }, data: { stock: { increment: add }, version: { increment: 1 } } }),
        client.stockMovement.create({
          data: {
            sku: r.sku,
            delta: add,
            stockAfter: r.stock + add,
            kind: "adjustment",
            reason: "Dostawa (dane demo)",
            actor: "system",
            at: new Date(cursor.at.getTime() - MIN),
          },
        }),
      ]);
      restocks += 1;
    }
  };

  // --- kroki w kolejnosci czasu (zmiany wielu zamowien przeplataja sie jak w rzeczywistosci)
  const steps: Step[] = [];
  for (const o of plan.orders) {
    steps.push({ at: o.createdAt, kind: "create", o });
    if (o.failedAt) steps.push({ at: o.failedAt, kind: "fail", o });
    if (o.paidAt) steps.push({ at: o.paidAt, kind: "pay", o });
    if (o.processingAt) steps.push({ at: o.processingAt, kind: "processing", o });
    if (o.shippedAt) steps.push({ at: o.shippedAt, kind: "shipped", o });
    if (o.deliveredAt) steps.push({ at: o.deliveredAt, kind: "delivered", o });
    if (o.cancelledAt) steps.push({ at: o.cancelledAt, kind: "cancel", o });
  }
  steps.sort((a, b) => a.at.getTime() - b.at.getTime());

  const created = new Map<PlannedOrder, { number: string; token: string; q: QuoteComputation }>();
  let skipped = 0;
  for (const step of steps) {
    cursor.at = step.at;
    const o = step.o;
    if (step.kind === "create") {
      await ensureStock(o.lines);
      let q: QuoteComputation;
      try {
        q = await quotes.compute({ items: o.lines, coupon: o.coupon, shippingMethod: o.shipping });
      } catch (e) {
        skipped += 1;
        log(`historia demo: pominieta wycena (${e instanceof Error ? e.message.slice(0, 120) : String(e)})`);
        continue;
      }
      if (q.unknown.length > 0) {
        skipped += 1;
        continue;
      }
      const body: OrderRequest = {
        items: o.lines,
        coupon: o.coupon,
        contact: {
          email: `klient-${String(o.contactNo).padStart(4, "0")}@taktyl.example`,
          phone: `500000${String(o.contactNo % 1000).padStart(3, "0")}`,
        },
        shipping:
          o.shipping === "automat"
            ? { method: "automat", point: o.point }
            : o.shipping === "kurier"
              ? { method: "kurier", name: "Klient Demonstracyjny", street: "ul. Przykładowa 1", postcode: "00-000", city: o.city }
              : { method: "odbior", name: "Klient Demonstracyjny" },
        invoice: null,
        payment_type: o.payment as OrderRequest["payment_type"],
        consents: { terms: true, newsletter: false },
        expected_total_gr: q.quote.total,
      };
      try {
        const res = await orders.create(body, o.idempotencyKey);
        created.set(o, { number: res.number, token: res.order_token, q });
      } catch (e) {
        skipped += 1;
        log(`historia demo: pominiete zamowienie (${e instanceof Error ? e.message : String(e)})`);
      }
      continue;
    }
    const c = created.get(o);
    if (!c) continue;
    try {
      if (step.kind === "fail") await payments.simulate(c.number, c.token, "failed");
      else if (step.kind === "pay") {
        await ensureStock(o.lines);
        await payments.simulate(c.number, c.token, "paid");
      } else if (step.kind === "cancel") {
        await admin.transition(c.number, { to: "cancelled", note: o.cancelReason ?? "Anulowane" }, SYSTEM);
      } else {
        await admin.transition(c.number, { to: step.kind }, SYSTEM);
      }
    } catch (e) {
      log(`historia demo: ${c.number} ${step.kind}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // --- oznaczenie danych demo i powrot stanow
  const numbers = [...created.values()].map((c) => c.number);
  await client.order.updateMany({ where: { number: { in: numbers } }, data: { demo: true } });
  const after = await client.variant.findMany({ select: { sku: true, stock: true } });
  const fixAt = new Date(opts.now.getTime() - 5 * MIN);
  for (const v of after) {
    const want = initial.get(v.sku);
    if (want === undefined || want === v.stock) continue;
    await client.$transaction([
      client.variant.update({ where: { sku: v.sku }, data: { stock: want, version: { increment: 1 } } }),
      client.stockMovement.create({
        data: {
          sku: v.sku,
          delta: want - v.stock,
          stockAfter: want,
          kind: "adjustment",
          reason: "Inwentaryzacja (dane demo)",
          actor: "system",
          at: fixAt,
        },
      }),
    ]);
  }

  // --- zdarzenia pomiaru (docs/10): sesje kupujacych ze zgoda + ruch bez zakupu
  const rows: Prisma.AnalyticsEventCreateManyInput[] = [];
  let sessions = plan.sessions.length;
  for (const s of plan.sessions) {
    for (const e of s.events) rows.push({ sessionId: s.sessionId, name: e.name, params: e.params as Prisma.InputJsonValue, ts: e.ts, receivedAt: e.ts, demo: true });
  }
  for (const [o, c] of created) {
    if (!o.sessionId) continue;
    sessions += 1;
    for (const e of orderJourney(o, c.number, c.q, snap, opts.now)) {
      rows.push({ sessionId: o.sessionId, name: e.name, params: e.params as Prisma.InputJsonValue, ts: e.ts, receivedAt: e.ts, demo: true });
    }
  }
  for (let i = 0; i < rows.length; i += EVENTS_CHUNK) {
    await client.analyticsEvent.createMany({ data: rows.slice(i, i + EVENTS_CHUNK) });
  }

  const report: DemoHistoryReport = {
    orders: created.size,
    skipped,
    sessions,
    events: rows.length,
    restocks,
    ms: Date.now() - t0,
  };
  await client.auditLog.create({
    data: {
      at: opts.now,
      actorId: null,
      actorRole: "system",
      action: "demo.history",
      entity: "demo",
      entityId: "history",
      after: { orders: report.orders, sessions: report.sessions, events: report.events, days: opts.days ?? 90 },
      requestId: `demo-history-${opts.now.getTime()}`,
    },
  });
  log(
    `historia demo: ${report.orders} zamowien (pominiete ${skipped}), ${report.sessions} sesji, ${report.events} zdarzen, ${restocks} dostaw, ${report.ms} ms`,
  );
  return report;
}

/** Zdarzenia sesji kupujacego (docs/10 par. 4-5, kolejnosc z par. 7) z kwotami z prawdziwej wyceny. */
export function orderJourney(
  o: PlannedOrder,
  number: string,
  q: QuoteComputation,
  snap: CatalogSnapshot,
  now: Date,
): PlannedEvent[] {
  const out: PlannedEvent[] = [];
  const setPercent = q.config.setDiscount.percent;
  const itemOf = (sku: string, extra: Parameters<typeof itemParam>[2] = {}) => {
    const found = q.index.get(sku);
    if (!found) return { item_id: sku };
    const v = found.variant;
    const parts = [snap.colors[v.color]?.label ?? v.color];
    if (v.switch !== undefined) parts.push(snap.switches.find((s) => s.id === v.switch)?.name ?? v.switch);
    if (v.size !== undefined) parts.push(found.product.attributes.sizes?.[v.size]?.label ?? v.size.toUpperCase());
    return itemParam(
      { id: found.product.id, name: found.product.name, category: found.product.category, variants: [] },
      { sku, color: v.color, priceGr: v.price, label: parts.join(" / ") },
      extra,
    );
  };
  const lineItems = (lineIdx: number) => {
    const line = q.quote.lines[lineIdx];
    if (!line) return [];
    return line.items.map((it, index) =>
      itemOf(it.sku, {
        quantity: line.qty,
        discountGr: line.type === "set" ? it.discount : 0,
        ...(line.type === "set" ? { promotion: `Rabat za set ${setPercent}%` } : {}),
        listId: o.listId,
        index,
      }),
    );
  };
  const allItems = q.quote.lines.flatMap((_, i) => lineItems(i));
  const value = zl(q.quote.afterDiscounts);
  const before: { name: string; params: Record<string, unknown> }[] = [];

  if (o.builder) {
    before.push({ name: "set_builder_start", params: { entry_point: o.builder.entryPoint } });
    before.push({ name: "set_profile_select", params: { profile: o.builder.profile, hand_cm: null } });
    const set = q.quote.lines.find((l) => l.type === "set");
    const steps = ["klawiatura", "myszka", "podkladka"];
    set?.items.forEach((it, i) => {
      const found = q.index.get(it.sku);
      before.push({
        name: "set_step_complete",
        params: { step: steps[i] ?? "klawiatura", item_id: it.sku, item_name: found?.product.name ?? it.sku },
      });
    });
    if (set) {
      before.push({
        name: "set_complete",
        params: { value: zl(set.value - set.setDiscount), discount: zl(set.setDiscount), profile: o.builder.profile, warnings: 0 },
      });
    }
  } else if (o.listId !== "wyszukiwarka") {
    before.push({ name: "view_item_list", params: { item_list_id: o.listId, item_list_name: String(allItems[0]?.item_list_name ?? o.listId) } });
  } else {
    before.push({ name: "search", params: { search_term: String(allItems[0]?.item_name ?? "").toLowerCase() } });
  }
  q.quote.lines.forEach((line, i) => {
    const items = lineItems(i);
    if (line.type === "item") {
      before.push({ name: "view_item", params: { currency: "PLN", value: zl(line.value / line.qty), items } });
    }
    before.push({ name: "add_to_cart", params: { currency: "PLN", value: zl(line.total), items } });
    if (line.type === "set" && o.builder) {
      before.push({
        name: "set_add_to_cart",
        params: {
          value: zl(line.total),
          discount: zl(line.setDiscount),
          profile: o.builder.profile,
          preset_id: o.builder.entryPoint === "preset" ? "gotowy" : null,
          warnings: 0,
        },
      });
    }
  });
  const coupon = q.quote.codeStatus === "applied" ? (o.coupon ?? "") : "";
  before.push({ name: "view_cart", params: { currency: "PLN", value, items: allItems } });
  before.push({ name: "begin_checkout", params: { currency: "PLN", value, coupon, items: allItems } });
  before.push({ name: "add_shipping_info", params: { currency: "PLN", value, shipping_tier: o.shipping, items: allItems } });
  before.push({ name: "add_payment_info", params: { currency: "PLN", value, payment_type: o.payment, items: allItems } });

  // Rozlozenie zdarzen przed zlozeniem zamowienia: od poczatku sesji do chwili utworzenia.
  const span = Math.max(1, o.createdAt.getTime() - o.sessionStart.getTime());
  before.forEach((e, i) => {
    out.push({ ...e, ts: new Date(o.sessionStart.getTime() + Math.floor((span * i) / before.length)) });
  });
  if (o.failedAt && o.failedAt <= now) {
    out.push({ name: "payment_failed", params: { transaction_id: number, payment_type: o.payment, value }, ts: o.failedAt });
    if (o.paidAt) {
      out.push({
        name: "add_payment_info",
        params: { currency: "PLN", value, payment_type: o.payment, items: allItems },
        ts: new Date(o.failedAt.getTime() + 30_000),
      });
    }
  }
  if (o.paidAt && o.paidAt <= now) {
    const shipping = zl(q.quote.shipping ?? 0);
    out.push({
      name: "purchase",
      params: {
        transaction_id: number,
        currency: "PLN",
        value,
        shipping,
        tax: Math.round(((value * 23) / 123) * 100) / 100,
        coupon,
        items: allItems,
      },
      ts: o.paidAt,
    });
  }
  return out;
}
