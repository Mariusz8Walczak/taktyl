// F-170...F-180, F-201, F-202 (B-219, B-220): integracyjne testy zamowien i symulacji platnosci (docs/12 S17-S20, docs/16 par. 5-6).
import { randomUUID } from "node:crypto";
import {
  orderCreatedSchema,
  orderDetailSchema,
  paymentSimulateResponseSchema,
  problemSchema,
} from "@taktyl/contracts";
import { beforeEach, afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootApp, hasDb, NOW, reseed, type TestEnv } from "./helpers.js";

const SET = {
  type: "set",
  id: "set-1696676400000",
  qty: 1,
  profile: "programowanie",
  skus: ["K-BZL75-GRF-PRG", "M-PST-GRF", "P-SZR-XL-GRF"],
};

function orderBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    items: [SET],
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
    expected_total_gr: 120330,
    ...over,
  };
}

/** NIP z losowych cyfr i wyliczonej cyfry kontrolnej (docs/12 par. 2: nigdy wpisany na stale). */
function generateNip(): string {
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  for (;;) {
    const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    const sum = digits.reduce((a, d, i) => a + d * (weights[i] as number), 0);
    if (sum % 11 !== 10) return [...digits, sum % 11].join("");
  }
}

describe.skipIf(!hasDb)("B-219/B-220 zamowienia i platnosci (PostgreSQL)", () => {
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

  const create = (body: unknown, key: string = randomUUID()) =>
    t
      .http()
      .post("/v1/orders")
      .set("Idempotency-Key", key)
      .send(body as object);
  const createOk = async (body: unknown, key?: string) => {
    const res = await create(body, key).expect(201);
    return orderCreatedSchema.parse(res.body);
  };
  const simulate = (number: string, token: string, outcome: "paid" | "failed") =>
    t
      .http()
      .post(`/v1/orders/${number}/payment/simulate`)
      .set("X-Order-Token", token)
      .send({ outcome });
  const stockOf = async (sku: string): Promise<number> =>
    (await t.prisma.variant.findUniqueOrThrow({ where: { sku } })).stock;

  it("tworzy zamowienie pending_payment z numerem TK-RRMMDD-XXXX, tokenem i terminem; stan bez zmian", async () => {
    const before = await stockOf("K-BZL75-GRF-PRG");
    const res = await create(orderBody()).expect(201);
    expect(res.headers["cache-control"]).toBe("no-store");
    const o = orderCreatedSchema.parse(res.body);
    expect(o.number).toMatch(/^TK-261007-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(o).toMatchObject({
      status: "pending_payment",
      items_total_gr: 120330,
      shipping_gr: 0,
      total_gr: 120330,
      eta: { dispatch_date: "2026-10-07", delivery_date: "2026-10-08" },
    });
    expect(o.payment.simulate_url).toBe(`/zamowienie/platnosc?id=${o.number}`);
    expect(await stockOf("K-BZL75-GRF-PRG")).toBe(before);

    // Baza trzyma tylko skrot tokenu, a niezmienniki kwot sa spelnione.
    const row = await t.prisma.order.findUniqueOrThrow({
      where: { number: o.number },
      include: { items: { orderBy: { id: "asc" } } },
    });
    expect(row.orderTokenHash).not.toContain(o.order_token);
    expect(row.orderTokenHash).toHaveLength(64);
    expect(row.items.reduce((a, i) => a + i.setDiscountGr, 0)).toBe(row.setDiscountGr);
    expect(row.setDiscountGr).toBe(13370);
    expect(row.totalGr).toBe(
      row.itemsGr - row.setDiscountGr - row.couponDiscountGr + row.shippingGr,
    );
    expect(row.items.map((i) => i.setDiscountGr)).toEqual([7490, 3990, 1890]);
    expect(row.items.every((i) => i.groupId === "set-1696676400000")).toBe(true);
  });

  it("odczyt: tylko z X-Order-Token (brak = 401, zly = 404), numer sam nie daje dostepu", async () => {
    const o = await createOk(orderBody());
    await t.http().get(`/v1/orders/${o.number}`).expect(401);
    await t.http().get(`/v1/orders/${o.number}`).set("X-Order-Token", "x".repeat(43)).expect(404);
    const res = await t
      .http()
      .get(`/v1/orders/${o.number}`)
      .set("X-Order-Token", o.order_token)
      .expect(200);
    const d = orderDetailSchema.parse(res.body);
    expect(d.status).toBe("pending_payment");
    expect(d.items).toHaveLength(3);
    expect(d.items[0]?.variant_label).toBe("Grafit · Próg");
    expect(JSON.stringify(res.body)).not.toContain("taktyl.example");
    const list = await t
      .http()
      .get("/v1/orders")
      .set("X-Order-Token", `${"y".repeat(20)},${o.order_token}`)
      .expect(200);
    expect((list.body as { items: unknown[] }).items).toHaveLength(1);
    await t.http().get("/v1/orders").expect(401);
  });

  it("TAKTYL-70: token wygasa po ORDER_RETENTION_DAYS (odczyt i lista dla starego zamowienia = 404 / pusto)", async () => {
    const o = await createOk(orderBody());
    await t.prisma.order.update({
      where: { number: o.number },
      data: { createdAt: new Date(NOW.getTime() - 31 * 86_400_000) },
    });
    await t.http().get(`/v1/orders/${o.number}`).set("X-Order-Token", o.order_token).expect(404);
    const list = await t.http().get("/v1/orders").set("X-Order-Token", o.order_token).expect(200);
    expect((list.body as { items: unknown[] }).items).toHaveLength(0);
  });

  it("idempotencja: ten sam klucz i cialo = to samo zamowienie i token; inne cialo = 409", async () => {
    const key = randomUUID();
    const a = await createOk(orderBody(), key);
    const b = await createOk(orderBody(), key);
    expect(b.number).toBe(a.number);
    expect(b.order_token).toBe(a.order_token);
    expect(await t.prisma.order.count()).toBe(1);
    const other = await create(orderBody({ coupon: "DOSTAWA0" }), key).expect(409);
    expect(problemSchema.parse(other.body).code).toBe("idempotency_conflict");
    expect(await t.prisma.order.count()).toBe(1);
  });

  it("rownolegle zadania z tym samym kluczem tworza jedno zamowienie", async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 4 }, () => create(orderBody(), key)));
    const numbers = new Set(
      results.filter((r) => r.status === 201).map((r) => (r.body as { number: string }).number),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(numbers.size).toBe(1);
    expect(await t.prisma.order.count()).toBe(1);
  });

  it("wymaga Idempotency-Key (UUID)", async () => {
    const res = await t.http().post("/v1/orders").send(orderBody()).expect(422);
    expect(problemSchema.parse(res.body).errors?.[0]?.path).toBe("Idempotency-Key");
    await t
      .http()
      .post("/v1/orders")
      .set("Idempotency-Key", "nie-uuid")
      .send(orderBody())
      .expect(422);
  });

  it("nie ufa kwocie klienta: inna suma = 409 price_changed i brak zamowienia", async () => {
    const res = await create(orderBody({ expected_total_gr: 100 })).expect(409);
    const p = problemSchema.parse(res.body);
    expect(p.code).toBe("price_changed");
    expect(p.errors?.[0]?.message).toContain("120330");
    expect(await t.prisma.order.count()).toBe(0);
  });

  it("odrzuca pola kart, kody BLIK i hasla oraz brak zgody na regulamin (strictObject)", async () => {
    for (const extra of [
      { card_number: "4111111111111111" },
      { blik_code: "123456" },
      { password: "tajne-haslo-123" },
      { payment: { card: "x" } },
    ]) {
      await create(orderBody(extra)).expect(422);
    }
    await create(
      orderBody({ contact: { email: "jan@taktyl.example", phone: "500000000", password: "x" } }),
    ).expect(422);
    await create(orderBody({ consents: { terms: false, newsletter: false } })).expect(422);
    expect(await t.prisma.order.count()).toBe(0);
  });

  it("S17: automat paczkowy - punkt zamiast adresu, dostawa 12,99 zl pponizej progu; nieznany punkt = 422", async () => {
    const body = orderBody({
      items: [{ type: "item", sku: "M-WRB-GRF", qty: 1 }],
      shipping: { method: "automat", point: "KRK-001" },
      expected_total_gr: 12900 + 1299,
    });
    const o = await createOk(body);
    expect(o.shipping_gr).toBe(1299);
    expect(o.total_gr).toBe(14199);
    const row = await t.prisma.order.findUniqueOrThrow({ where: { number: o.number } });
    expect(row.shippingAddress).toEqual({ point: "KRK-001" });
    const bad = await create({ ...body, shipping: { method: "automat", point: "ZZZ-999" } }).expect(
      422,
    );
    expect(problemSchema.parse(bad.body).errors?.[0]?.path).toBe("shipping.point");
    await create({
      ...body,
      shipping: { method: "automat", point: "KRK-001", street: "ul. X 1" },
    }).expect(422);
  });

  it("kurier wymaga adresu (pola z shop settings), kod pocztowy NN-NNN", async () => {
    await create(orderBody({ shipping: { method: "kurier", name: "Jan Przykładowy" } })).expect(
      422,
    );
    await create(
      orderBody({
        shipping: {
          method: "kurier",
          name: "Jan Przykładowy",
          street: "ul. X 1",
          postcode: "00000",
          city: "Warszawa",
        },
      }),
    ).expect(422);
  });

  it("S18: faktura - bledny NIP = 422 z path invoice.nip, poprawny (generowany) przechodzi", async () => {
    const invoice = {
      nip: generateNip(),
      name: "Firma Przykładowa Sp. z o.o.",
      address: "ul. Firmowa 2, 00-000 Warszawa",
    };
    const wrong = `${invoice.nip.slice(0, 9)}${(Number(invoice.nip[9]) + 1) % 10}`;
    const res = await create(orderBody({ invoice: { ...invoice, nip: wrong } })).expect(422);
    expect(problemSchema.parse(res.body).errors?.map((e) => e.path)).toContain("invoice.nip");
    const o = await createOk(orderBody({ invoice }));
    const row = await t.prisma.order.findUniqueOrThrow({ where: { number: o.number } });
    expect((row.invoice as { nip: string }).nip).toBe(invoice.nip);
  });

  it("brak towaru K-BZL75-KOB-SZP = 409 out_of_stock z lista SKU (items[n].sku), nieznany SKU = 422", async () => {
    const res = await create(
      orderBody({
        items: [
          { type: "item", sku: "M-WRB-GRF", qty: 1 },
          { type: "item", sku: "K-BZL75-KOB-SZP", qty: 1 },
        ],
        expected_total_gr: 12900 + 69900,
      }),
    ).expect(409);
    const p = problemSchema.parse(res.body);
    expect(p.code).toBe("out_of_stock");
    expect(p.errors?.map((e) => e.path)).toEqual(["items[1].sku"]);
    expect(await t.prisma.order.count()).toBe(0);
    const unknown = await create(
      orderBody({ items: [{ type: "item", sku: "M-ZZZ-GRF", qty: 1 }] }),
    ).expect(422);
    expect(problemSchema.parse(unknown.body).errors?.[0]?.code).toBe("unknown_sku");
  });

  it("S14: kod TAKTYL10 poza setem, razem 1265,40 zl zapisane w pozycjach zamowienia", async () => {
    const o = await createOk(
      orderBody({
        items: [SET, { type: "item", sku: "P-TFL-M-GRF", qty: 1 }],
        coupon: "TAKTYL10",
        expected_total_gr: 126540,
      }),
    );
    expect(o.total_gr).toBe(126540);
    const row = await t.prisma.order.findUniqueOrThrow({
      where: { number: o.number },
      include: { items: true },
    });
    expect(row.couponCode).toBe("TAKTYL10");
    expect(row.couponDiscountGr).toBe(690);
    expect(row.items.reduce((a, i) => a + i.couponDiscountGr, 0)).toBe(690);
  });

  it("S19: failed -> ponowna proba -> paid; stan zmniejszony raz, jeden ruch sale na SKU, historia i outbox", async () => {
    const skus = SET.skus;
    const before = await Promise.all(skus.map(stockOf));
    const o = await createOk(orderBody());

    const failed = await simulate(o.number, o.order_token, "failed").expect(200);
    expect(paymentSimulateResponseSchema.parse(failed.body)).toEqual({
      status: "payment_failed",
      transaction_id: o.number,
    });
    expect(await Promise.all(skus.map(stockOf))).toEqual(before);

    const paid = await simulate(o.number, o.order_token, "paid").expect(200);
    expect(paymentSimulateResponseSchema.parse(paid.body)).toEqual({
      status: "paid",
      transaction_id: o.number,
    });
    expect(await Promise.all(skus.map(stockOf))).toEqual(before.map((s) => s - 1));

    // S20: powtorzenie po paid jest idempotentne - brak drugiego zdjecia stanu.
    const again = await simulate(o.number, o.order_token, "paid").expect(200);
    expect((again.body as { status: string }).status).toBe("paid");
    expect(await Promise.all(skus.map(stockOf))).toEqual(before.map((s) => s - 1));
    expect(
      await t.prisma.stockMovement.count({ where: { orderNumber: o.number, kind: "sale" } }),
    ).toBe(3);

    const history = await t.prisma.orderStatusHistory.findMany({
      where: { orderNumber: o.number },
      orderBy: { id: "asc" },
    });
    expect(history.map((h) => h.toStatus)).toEqual([
      "pending_payment",
      "payment_failed",
      "pending_payment",
      "paid",
    ]);
    const pay = await t.prisma.payment.findUniqueOrThrow({ where: { orderNumber: o.number } });
    expect(pay).toMatchObject({ status: "paid", attempts: 2 });

    const detail = orderDetailSchema.parse(
      (await t.http().get(`/v1/orders/${o.number}`).set("X-Order-Token", o.order_token).expect(200))
        .body,
    );
    expect(detail.status).toBe("paid");

    const outbox = await t.prisma.outbox.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.status).toBe("pending");
    expect(outbox[0]?.tags).toEqual(
      expect.arrayContaining([
        "product:bazalt-75",
        "category:klawiatury",
        "facets:klawiatury",
        "category:podkladki",
      ]),
    );

    // failed po paid = niedozwolone przejscie.
    const invalid = await simulate(o.number, o.order_token, "failed").expect(409);
    expect(problemSchema.parse(invalid.body).code).toBe("invalid_transition");
  });

  it("simulate wymaga tokenu i poprawnego ciala (strictObject)", async () => {
    const o = await createOk(orderBody());
    await t
      .http()
      .post(`/v1/orders/${o.number}/payment/simulate`)
      .send({ outcome: "paid" })
      .expect(401);
    await t
      .http()
      .post(`/v1/orders/${o.number}/payment/simulate`)
      .set("X-Order-Token", "z".repeat(43))
      .send({ outcome: "paid" })
      .expect(404);
    await t
      .http()
      .post(`/v1/orders/${o.number}/payment/simulate`)
      .set("X-Order-Token", o.order_token)
      .send({ outcome: "maybe" })
      .expect(422);
    await t
      .http()
      .post(`/v1/orders/${o.number}/payment/simulate`)
      .set("X-Order-Token", o.order_token)
      .send({ outcome: "paid", card_number: "4111" })
      .expect(422);
  });

  it("brak stanu przy paid: 409 out_of_stock z lista SKU, stany i status bez zmian", async () => {
    const item = { type: "item", sku: "M-JRZ-MGL", qty: 2 };
    const a = await createOk(
      orderBody({
        items: [item],
        shipping: { method: "odbior", name: "Jan Przykładowy" },
        expected_total_gr: 2 * 44900 - 0,
      }),
    );
    const b = await createOk(
      orderBody({
        items: [item],
        shipping: { method: "odbior", name: "Jan Przykładowy" },
        expected_total_gr: 2 * 44900,
      }),
    );
    await simulate(a.number, a.order_token, "paid").expect(200);
    expect(await stockOf("M-JRZ-MGL")).toBe(0);
    const res = await simulate(b.number, b.order_token, "paid").expect(409);
    const p = problemSchema.parse(res.body);
    expect(p.code).toBe("out_of_stock");
    expect(p.errors?.[0]?.path).toBe("items[0].sku");
    expect(await stockOf("M-JRZ-MGL")).toBe(0);
    expect((await t.prisma.order.findUniqueOrThrow({ where: { number: b.number } })).status).toBe(
      "pending_payment",
    );
    expect(await t.prisma.stockMovement.count({ where: { orderNumber: b.number } })).toBe(0);
  });

  it("wyscig o ostatnie sztuki: rownolegle paid dwoch zamowien - jedno przechodzi, stan nie schodzi ponizej zera", async () => {
    const item = { type: "item", sku: "M-JRZ-MGL", qty: 2 };
    const mk = () =>
      createOk(
        orderBody({
          items: [item],
          shipping: { method: "odbior", name: "Jan Przykładowy" },
          expected_total_gr: 2 * 44900,
        }),
      );
    const [a, b] = [await mk(), await mk()];
    const [ra, rb] = await Promise.all([
      simulate(a.number, a.order_token, "paid"),
      simulate(b.number, b.order_token, "paid"),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    expect(await stockOf("M-JRZ-MGL")).toBe(0);
    expect(await t.prisma.stockMovement.count({ where: { sku: "M-JRZ-MGL", kind: "sale" } })).toBe(
      1,
    );
  });

  it("rownolegle simulate paid tego samego zamowienia zdejmuje stan raz", async () => {
    const o = await createOk(orderBody());
    const before = await stockOf("M-PST-GRF");
    const rs = await Promise.all(
      Array.from({ length: 4 }, () => simulate(o.number, o.order_token, "paid")),
    );
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(await stockOf("M-PST-GRF")).toBe(before - 1);
  });

  it("suma ruchow magazynowych = stan wariantu po sprzedazy (docs/17 par. 10)", async () => {
    const o = await createOk(orderBody());
    await simulate(o.number, o.order_token, "paid").expect(200);
    const rows = await t.prisma.$queryRaw<{ sku: string; stock: number; moved: bigint }[]>`
      SELECT v.sku, v.stock, COALESCE(SUM(m.delta), 0) AS moved
      FROM variants v LEFT JOIN stock_movements m ON m.sku = v.sku GROUP BY v.sku, v.stock`;
    expect(rows).toHaveLength(329);
    for (const r of rows) expect(Number(r.moved)).toBe(r.stock);
  });
});
