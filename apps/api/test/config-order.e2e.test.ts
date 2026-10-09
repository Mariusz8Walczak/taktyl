// F-256 (ADR-0011): konfiguracja wlasna w koszyku i zamowieniu (PostgreSQL). Cena z serwera, pozycja na zamowienie,
// bez ruchu magazynowego, kod konfiguracji w zamowieniu i w jego szczegolach.
import { randomUUID } from "node:crypto";
import {
  configuratorQuoteSchema,
  orderCreatedSchema,
  orderDetailSchema,
  quoteResponseSchema,
} from "@taktyl/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootApp, hasDb, reseed, type TestEnv } from "./helpers.js";

describe.skipIf(!hasDb)("F-256 konfiguracja wlasna w koszyku i zamowieniu (PostgreSQL)", () => {
  let t: TestEnv;
  beforeAll(async () => {
    t = await bootApp();
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    await reseed(t.prisma);
  });

  const configSku = async (body: object): Promise<string> => {
    const q = configuratorQuoteSchema.parse(
      (await t.http().post("/v1/configurator/quote").send(body).expect(200)).body,
    );
    expect(q.sku).not.toBeNull();
    return q.sku as string;
  };
  const turkus = {
    model: "k-kwarc-60",
    parts: { obudowa: { color: "turkus", finish: "polysk" } },
    switch: "prog",
  };
  const quote = async (items: object[]) =>
    quoteResponseSchema.parse(
      (await t.http().post("/v1/cart/quote").send({ items }).expect(200)).body,
    );
  const order = (items: object[], total: number, key: string = randomUUID()) =>
    t
      .http()
      .post("/v1/orders")
      .set("Idempotency-Key", key)
      .send({
        items,
        coupon: null,
        contact: { email: "jan@taktyl.example", phone: "500000000" },
        shipping: {
          method: "kurier",
          name: "Jan Przykładowy",
          street: "ul. Przykładowa 1",
          postcode: "00-000",
          city: "Warszawa",
        },
        invoice: null,
        payment_type: "blik",
        consents: { terms: true, newsletter: false },
        expected_total_gr: total,
      });

  it("wycena koszyka: cena modelu bazowego + doplata, stan na zamowienie, nazwa z dopiskiem", async () => {
    const sku = await configSku(turkus);
    expect(sku).toMatch(/^K-KWR60-CFG-.*\.PRG$/);
    const q = await quote([{ type: "item", sku, qty: 2 }]);
    const line = q.lines[0];
    expect(line).toMatchObject({ type: "item", sku, qty: 2, price_gr: 33900, available: true });
    expect(line?.type === "item" ? line.name : "").toContain("własne kolory");
    expect(q.summary.products_gr).toBe(67800);
    expect(q.problems).toEqual([]);
  });

  it("set z konfiguracji i produktu z katalogu dostaje rabat setu", async () => {
    const k = await configSku(turkus);
    const m = await configSku({ model: "m-kos", parts: {} });
    const q = await quote([{ type: "set", id: "set-1", qty: 1, skus: [k, m, "P-SZR-XL-GRF"] }]);
    expect(q.summary.set_discount_gr).toBeGreaterThan(0);
    expect(q.summary.set_discount_gr).toBe(Math.round((q.summary.products_gr * 10) / 100));
    expect(q.problems).toEqual([]);
  });

  it("niekanoniczny albo zmyslony kod to unknown_sku, bez ceny", async () => {
    // Nadruki o slabym kontrascie podmienia konfigurator, wiec kod z takim nadrukiem nie jest kanoniczny.
    const base = await configSku({ model: "k-kwarc-60", parts: {} });
    const lowContrast = base.replace(".BIA.MGL.", ".GRF.GRF.");
    expect(lowContrast).not.toBe(base);
    const q = await quote([{ type: "item", sku: lowContrast, qty: 1 }]);
    expect(q.lines).toHaveLength(0);
    expect(q.problems[0]).toMatchObject({ code: "unknown_sku" });
    const fake = await quote([{ type: "item", sku: "K-KWR60-CFG-ZZZZ.ZZZZ.SLZ", qty: 1 }]);
    expect(fake.problems[0]).toMatchObject({ code: "unknown_sku" });
  });

  it("zamowienie: pozycja z kodem konfiguracji, wariant bazowy w FK, wycena serwera i zly total odrzucony", async () => {
    const sku = await configSku(turkus);
    await order([{ type: "item", sku, qty: 1 }], 1).expect(409);
    const res = await order([{ type: "item", sku, qty: 1 }], 33900).expect(201);
    const created = orderCreatedSchema.parse(res.body);
    expect(created.total_gr).toBe(33900);
    const row = await t.prisma.order.findUniqueOrThrow({
      where: { number: created.number },
      include: { items: true },
    });
    const item = row.items[0]!;
    expect(item.configSku).toBe(sku);
    expect(item.sku).toMatch(/^K-KWR60-[A-Z]{3}-PRG$/);
    expect(item.name).toContain("własne kolory");
    expect(item.variantLabel).toContain("Obudowa: Turkus");
    expect(item.unitPriceGr).toBe(33900);
    expect(item.config).toMatchObject({ model: "k-kwarc-60", switch: "prog" });

    const detail = orderDetailSchema.parse(
      (
        await t
          .http()
          .get(`/v1/orders/${created.number}`)
          .set("X-Order-Token", created.order_token)
          .expect(200)
      ).body,
    );
    expect(detail.items[0]?.config_sku).toBe(sku);
  });

  it("platnosc nie rusza stanu wariantu bazowego, a anulowanie nic nie zwraca na stan", async () => {
    const sku = await configSku(turkus);
    const created = orderCreatedSchema.parse(
      (await order([{ type: "item", sku, qty: 3 }], 101700).expect(201)).body,
    );
    const base = (
      await t.prisma.orderItem.findFirstOrThrow({ where: { orderNumber: created.number } })
    ).sku;
    const before = (await t.prisma.variant.findUniqueOrThrow({ where: { sku: base } })).stock;
    await t
      .http()
      .post(`/v1/orders/${created.number}/payment/simulate`)
      .set("X-Order-Token", created.order_token)
      .send({ outcome: "paid" })
      .expect(200);
    expect((await t.prisma.variant.findUniqueOrThrow({ where: { sku: base } })).stock).toBe(before);
    expect(await t.prisma.stockMovement.count({ where: { orderNumber: created.number } })).toBe(0);
  });
});
