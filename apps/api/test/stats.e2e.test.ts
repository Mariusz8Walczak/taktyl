// B-610..B-626, B-621, B-622 (docs/25, ADR-0012): kolektor zdarzen, generator historii demo przez prawdziwa logike
// zamowien, statystyki pulpitu i ruchu z porownaniem okresow, operacje, kondycja systemu i wyszukiwarka (PostgreSQL).
import {
  ANALYTICS_EVENT_NAMES,
  adminSearchSchema,
  operationsStatsSchema,
  salesStatsSchema,
  systemStatusSchema,
  trafficStatsSchema,
} from "@taktyl/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { generateDemoHistory } from "../src/demo-history/generator.js";
import { addUser, login, type LoggedIn, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, NOW, reseed, type TestEnv } from "./helpers.js";

const PAID = ["paid", "processing", "shipped", "delivered"];
const DAYS = 21;

describe.skipIf(!hasDb)("B-610..B-626 statystyki, kolektor i historia demo (PostgreSQL)", () => {
  let t: TestEnv;
  let viewer: LoggedIn;
  let seedStock: Map<string, number>;
  let firstNumbers: string[] = [];

  beforeAll(async () => {
    t = await bootApp();
    await resetAuth(t.prisma);
    const password = pw();
    await addUser(t.prisma, "podglad-stat@taktyl.example", "viewer", password);
    viewer = await login(t, "podglad-stat@taktyl.example", password, "10.9.0.1");
    seedStock = new Map(
      (await t.prisma.variant.findMany({ select: { sku: true, stock: true } })).map((v) => [
        v.sku,
        v.stock,
      ]),
    );
  });
  afterAll(async () => {
    await resetAuth(t.prisma);
    await t.close();
  });

  const get = async (path: string, session: LoggedIn | null = viewer) => {
    const req = t.http().get(path);
    if (session) req.set("Cookie", session.cookie);
    return req;
  };

  describe("B-621 POST /v1/events", () => {
    const ts = new Date(NOW.getTime() - 60_000).toISOString();
    it("202 i zapis zdarzen z docs/10 bez zmian nazw i parametrow", async () => {
      const res = await t
        .http()
        .post("/v1/events")
        .send({
          session_id: "test_sesja_0001",
          events: [
            {
              name: "view_item",
              params: { currency: "PLN", value: 749, items: [{ item_id: "K-BZL75-GRF-PRG" }] },
              ts,
            },
            { name: "set_builder_start", params: { entry_point: "hero" }, ts },
          ],
        });
      expect(res.status, JSON.stringify(res.body)).toBe(202);
      expect(res.body).toEqual({ accepted: 2 });
      const rows = await t.prisma.analyticsEvent.findMany({
        where: { sessionId: "test_sesja_0001" },
        orderBy: { id: "asc" },
      });
      expect(rows.map((r) => r.name)).toEqual(["view_item", "set_builder_start"]);
      expect(rows[0]?.params).toEqual({
        currency: "PLN",
        value: 749,
        items: [{ item_id: "K-BZL75-GRF-PRG" }],
      });
      expect(rows.every((r) => r.demo === false)).toBe(true);
    });

    it("422: nazwa spoza docs/10, dane osobowe, czas poza oknem 48 h, wiecej niz 20 zdarzen", async () => {
      const bad = async (body: object) => (await t.http().post("/v1/events").send(body)).status;
      expect(
        await bad({
          session_id: "test_sesja_0002",
          events: [{ name: "page_view", params: {}, ts }],
        }),
      ).toBe(422);
      expect(
        await bad({
          session_id: "test_sesja_0002",
          events: [{ name: "search", params: { search_term: "a@taktyl.example" }, ts }],
        }),
      ).toBe(422);
      expect(
        await bad({
          session_id: "test_sesja_0002",
          events: [{ name: "search", params: { search_term: "mysz" }, ts: "2026-09-01T10:00:00Z" }],
        }),
      ).toBe(422);
      expect(
        await bad({
          session_id: "test_sesja_0002",
          events: Array.from({ length: 21 }, () => ({ name: "view_cart", params: {}, ts })),
        }),
      ).toBe(422);
      expect(await t.prisma.analyticsEvent.count({ where: { sessionId: "test_sesja_0002" } })).toBe(
        0,
      );
    });
  });

  describe("B-622 generator historii demo", () => {
    it("tworzy zamowienia przez wycene i platnosc, oznacza demo, przywraca stany, zapisuje ruch i jeden wpis dziennika", async () => {
      await reseed(t.prisma);
      const report = await generateDemoHistory(t.prisma, {
        now: NOW,
        config: loadEnv(process.env),
        days: DAYS,
      });
      expect(report.orders).toBeGreaterThan(60);
      expect(report.skipped).toBe(0);
      expect(report.events).toBeGreaterThan(report.orders);

      const orders = await t.prisma.order.findMany({
        include: { items: true, statusHistory: true },
        orderBy: { number: "asc" },
      });
      firstNumbers = orders.map((o) => o.number);
      expect(orders).toHaveLength(report.orders);
      expect(orders.every((o) => o.demo)).toBe(true);
      expect(orders.every((o) => o.createdAt < NOW)).toBe(true);
      // kwoty z prawdziwej wyceny: suma = pozycje - rabaty + dostawa
      for (const o of orders) {
        expect(o.totalGr).toBe(o.itemsGr - o.setDiscountGr - o.couponDiscountGr + o.shippingGr);
      }
      expect(orders.some((o) => o.setDiscountGr > 0)).toBe(true);
      expect(orders.some((o) => o.items.some((i) => i.configSku !== null))).toBe(true);
      expect(new Set(orders.map((o) => o.status)).size).toBeGreaterThanOrEqual(4);
      // kazde oplacone zamowienie ma przejscie pending_payment -> paid w historii
      for (const o of orders.filter((x) => PAID.includes(x.status))) {
        expect(o.statusHistory.some((h) => h.toStatus === "paid")).toBe(true);
        expect(o.paidAt).not.toBeNull();
      }
      // stany wracaja do seeda (pulpit i sklep bez zmian w stanach)
      const now = await t.prisma.variant.findMany({ select: { sku: true, stock: true } });
      for (const v of now) expect(v.stock, v.sku).toBe(seedStock.get(v.sku));
      expect(await t.prisma.stockMovement.count({ where: { kind: "sale" } })).toBeGreaterThan(0);
      // ruch demo i jeden wpis dziennika
      expect(await t.prisma.analyticsEvent.count({ where: { demo: true } })).toBe(report.events);
      expect(
        await t.prisma.analyticsEvent.count({
          where: { demo: true, name: { notIn: [...ANALYTICS_EVENT_NAMES] } },
        }),
      ).toBe(0);
      const audit = await t.prisma.auditLog.findMany({ where: { action: "demo.history" } });
      expect(audit).toHaveLength(1);
      expect(await t.prisma.auditLog.count({ where: { action: "order.transition" } })).toBe(0);
    }, 240_000);

    it("jest deterministyczny: ta sama chwila i katalog daja te same numery zamowien", async () => {
      await reseed(t.prisma);
      await generateDemoHistory(t.prisma, { now: NOW, config: loadEnv(process.env), days: DAYS });
      const again = (
        await t.prisma.order.findMany({ select: { number: true }, orderBy: { number: "asc" } })
      ).map((o) => o.number);
      expect(again).toEqual(firstNumbers);
    }, 240_000);
  });

  describe("B-610..B-618 statystyki (po historii demo)", () => {
    it("B-610, B-611: KPI zgodne z baza, dni zakresu, porownanie z poprzednim okresem", async () => {
      const res = await get("/v1/admin/stats/sales?from=2026-09-27&to=2026-10-07");
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const s = salesStatsSchema.parse(res.body);
      expect(s.range).toMatchObject({
        from: "2026-09-27",
        to: "2026-10-07",
        days: 11,
        previous: { from: "2026-09-16", to: "2026-09-26" },
      });
      expect(s.daily).toHaveLength(11);
      expect(s.demo_data).toBe(true);
      const paid = await t.prisma.order.findMany({
        where: {
          status: { in: PAID },
          paidAt: { gte: new Date("2026-09-26T22:00:00Z"), lt: new Date("2026-10-07T22:00:00Z") },
        },
        select: { totalGr: true },
      });
      const revenue = paid.reduce((sum, o) => sum + o.totalGr, 0);
      expect(s.kpi.revenue_gr.value).toBe(revenue);
      expect(s.daily.reduce((sum, d) => sum + d.revenue_gr, 0)).toBe(revenue);
      expect(s.kpi.paid_orders.value).toBe(paid.length);
      expect(s.kpi.aov_gr.value).toBe(paid.length ? Math.round(revenue / paid.length) : 0);
      expect(s.kpi.revenue_gr.previous).not.toBeNull();
      expect(s.kpi.set_share_bp.value).toBeGreaterThan(0);
      expect(s.kpi.set_share_bp.value).toBeLessThanOrEqual(10_000);
    });

    it("B-612..B-617: lejek, mapa cieplna 7x24, sety, konfiguracje, kolory, top produkty", async () => {
      const s = salesStatsSchema.parse(
        (await get("/v1/admin/stats/sales?from=2026-09-17&to=2026-10-07&compare=none")).body,
      );
      expect(s.range.previous).toBeNull();
      expect(s.kpi.revenue_gr.previous).toBeNull();
      expect(s.funnel.reached.paid).toBeGreaterThanOrEqual(s.funnel.reached.processing);
      expect(s.funnel.reached.processing).toBeGreaterThanOrEqual(s.funnel.reached.shipped);
      expect(s.funnel.transitions.find((x) => x.from === "pending_payment")?.count).toBeGreaterThan(
        0,
      );
      expect(s.heatmap.cells).toHaveLength(168);
      expect(s.heatmap.cells.reduce((sum, c) => sum + c.orders, 0)).toBe(s.funnel.created);
      expect(s.sets.orders_with_set).toBeGreaterThan(0);
      expect(s.sets.set_discount_gr).toBeGreaterThan(0);
      expect(s.configurator.items).toBeGreaterThan(0);
      expect(s.configurator.by_model.length).toBeGreaterThan(0);
      expect(s.colors[0]?.swatch).toMatch(/^#/);
      expect(s.top_products.length).toBeGreaterThan(0);
      const top = s.top_products.map((p) => p.revenue_gr);
      expect([...top].sort((a, b) => b - a)).toEqual(top);
    });

    it("400 dla odwroconego i zbyt dlugiego zakresu", async () => {
      expect((await get("/v1/admin/stats/sales?from=2026-10-07&to=2026-10-01")).status).toBe(400);
      expect((await get("/v1/admin/stats/sales?from=2024-01-01&to=2026-10-01")).status).toBe(400);
    });

    it("B-620: ruch z kolektora - sesje, lejek, konwersja, porzucone koszyki", async () => {
      const res = await get("/v1/admin/stats/traffic?from=2026-09-17&to=2026-10-07");
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const tr = trafficStatsSchema.parse(res.body);
      expect(tr.kpi.sessions.value).toBeGreaterThan(100);
      expect(tr.kpi.purchases.value).toBeGreaterThan(0);
      expect(tr.kpi.conversion_bp.value).toBeGreaterThan(0);
      expect(tr.kpi.abandoned_carts.value).toBeGreaterThan(0);
      expect(tr.funnel.map((f) => f.step)).toEqual([
        "view_item",
        "add_to_cart",
        "begin_checkout",
        "purchase",
      ]);
      expect(tr.daily).toHaveLength(21);
      expect(tr.builder.starts).toBeGreaterThan(0);
      expect(tr.top_items.length).toBeGreaterThan(0);
      expect(tr.demo_data).toBe(true);
    });

    it("B-618: operacje - niski stan z prognoza, Omnibus z historii cen, zdjecia, outbox", async () => {
      const o = operationsStatsSchema.parse((await get("/v1/admin/stats/operations")).body);
      const skus = o.low_stock.items.map((i) => i.sku);
      expect(skus).toEqual(expect.arrayContaining(["K-BZL75-KOB-SZP", "P-LOD-L-MGL"]));
      expect(o.images.p0_total).toBe(76);
      expect(o.omnibus.length).toBeGreaterThan(0);
      for (const p of o.omnibus) expect(p.lowest_30d_gr).toBeGreaterThan(p.price_gr);
    });

    it("B-623, B-626: kondycja systemu i wyszukiwarka globalna", async () => {
      const sys = systemStatusSchema.parse((await get("/v1/admin/system")).body);
      expect(sys.services.find((x) => x.id === "db")?.status).toBe("ok");
      expect(sys.stack.map((x) => x.name)).toEqual(
        expect.arrayContaining(["Node.js", "NestJS", "PostgreSQL"]),
      );
      expect(sys.migrations.applied).toBeGreaterThan(0);
      const byName = adminSearchSchema.parse((await get("/v1/admin/search?q=lupek")).body);
      expect(byName.products.map((p) => p.name)).toContain("Łupek 65");
      const bySku = adminSearchSchema.parse((await get("/v1/admin/search?q=M-WRB")).body);
      expect(bySku.products.some((p) => p.sku?.startsWith("M-WRB"))).toBe(true);
      const number = firstNumbers[0] as string;
      const byOrder = adminSearchSchema.parse(
        (await get(`/v1/admin/search?q=${number.slice(-4)}`)).body,
      );
      expect(byOrder.orders.map((x) => x.number)).toContain(number);
    });

    it("kazda trasa wymaga sesji (401 bez niej)", async () => {
      for (const p of [
        "/v1/admin/stats/sales",
        "/v1/admin/stats/traffic",
        "/v1/admin/stats/operations",
        "/v1/admin/system",
        "/v1/admin/search?q=x",
      ]) {
        expect((await get(p, null)).status, p).toBe(401);
      }
    });
  });
});
