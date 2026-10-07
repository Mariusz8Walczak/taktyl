// B-200...B-209 (TAKTYL-48): zamowienia w backpanelu - lista, szczegoly, maszyna stanow, anulowanie ze zwrotem stanow,
// notatki, maskowanie danych osobowych dla viewer, retencja danych osobowych (PostgreSQL).
import { randomUUID } from "node:crypto";
import {
  adminOrderDetailSchema,
  adminOrderListSchema,
  orderCreatedSchema,
  problemSchema,
} from "@taktyl/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { OrderRetentionService } from "../src/admin-orders/order-retention.service.js";
import { addUser, login, type LoggedIn, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, NOW, reseed, type TestEnv } from "./helpers.js";

const SET = {
  type: "set",
  id: "set-1696676400000",
  qty: 1,
  profile: "programowanie",
  skus: ["K-BZL75-GRF-PRG", "M-PST-GRF", "P-SZR-XL-GRF"],
};
const SET_SKUS = SET.skus;

function orderBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    items: [SET],
    coupon: null,
    contact: { email: "jan@taktyl.example", phone: "500000123" },
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

describe.skipIf(!hasDb)("B-200..B-209 zamowienia w backpanelu (PostgreSQL)", () => {
  let t: TestEnv;
  let now = new Date(NOW);
  const accounts = {
    owner: { email: "wlasciciel@taktyl.example", password: pw() },
    editor: { email: "edytor@taktyl.example", password: pw() },
    viewer: { email: "podglad@taktyl.example", password: pw() },
  };
  const sessions = {} as Record<"owner" | "editor" | "viewer", LoggedIn>;

  beforeAll(async () => {
    t = await bootApp({ clock: () => now });
    await resetAuth(t.prisma);
    for (const [role, a] of Object.entries(accounts)) {
      await addUser(t.prisma, a.email, role as "owner" | "editor" | "viewer", a.password);
    }
    sessions.owner = await login(t, accounts.owner.email, accounts.owner.password, "10.5.0.1");
    sessions.editor = await login(t, accounts.editor.email, accounts.editor.password, "10.5.0.2");
    sessions.viewer = await login(t, accounts.viewer.email, accounts.viewer.password, "10.5.0.3");
  });
  afterAll(async () => {
    await resetAuth(t.prisma);
    await t.close();
  });
  beforeEach(async () => {
    now = new Date(NOW);
    await reseed(t.prisma); // zachowuje konta i sesje (RESET_KEEP_TABLES)
  });

  const get = (role: keyof typeof sessions, path: string) =>
    t.http().get(path).set("Cookie", sessions[role].cookie);
  const post = (role: keyof typeof sessions, path: string, body: object) =>
    t
      .http()
      .post(path)
      .set("Cookie", sessions[role].cookie)
      .set("X-CSRF-Token", sessions[role].csrf)
      .send(body);

  const createOrder = async (over: Record<string, unknown> = {}) => {
    const res = await t
      .http()
      .post("/v1/orders")
      .set("Idempotency-Key", randomUUID())
      .send(orderBody(over));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return orderCreatedSchema.parse(res.body);
  };
  const pay = async (number: string, token: string, outcome: "paid" | "failed" = "paid") => {
    const res = await t
      .http()
      .post(`/v1/orders/${number}/payment/simulate`)
      .set("X-Order-Token", token)
      .send({ outcome });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  };
  const paidOrder = async (over: Record<string, unknown> = {}) => {
    const o = await createOrder(over);
    await pay(o.number, o.order_token);
    return o;
  };
  const stockOf = async (sku: string) =>
    (await t.prisma.variant.findUniqueOrThrow({ where: { sku } })).stock;
  const stocks = async () =>
    Object.fromEntries(await Promise.all(SET_SKUS.map(async (s) => [s, await stockOf(s)])));

  it("B-200/B-201: lista - kontrakt, e-mail zamaskowany dla kazdej roli, liczba pozycji, filtry w adresie, stronicowanie", async () => {
    const a = await paidOrder();
    const b = await createOrder({ payment_type: "przelew" });
    const res = await get("owner", "/v1/admin/orders");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    const list = adminOrderListSchema.parse(res.body);
    expect(list.total).toBe(2);
    const row = list.items.find((i) => i.number === a.number);
    expect(row).toMatchObject({
      status: "paid",
      total_gr: 120330,
      payment_type: "blik",
      shipping_method: "kurier",
      contact_email: "j***@taktyl.example",
      items_count: 3,
    });
    for (const role of ["owner", "editor", "viewer"] as const) {
      const r = await get(role, "/v1/admin/orders");
      expect(r.status).toBe(200);
      expect(JSON.stringify(r.body)).not.toContain("jan@taktyl.example");
    }
    expect(
      adminOrderListSchema.parse((await get("owner", "/v1/admin/orders?status=paid")).body).total,
    ).toBe(1);
    expect(
      adminOrderListSchema.parse(
        (await get("owner", "/v1/admin/orders?status=pending_payment")).body,
      ).total,
    ).toBe(1);
    expect(
      adminOrderListSchema.parse((await get("owner", "/v1/admin/orders?status=cancelled")).body)
        .total,
    ).toBe(0);
    const tail = a.number.slice(-4).toLowerCase();
    expect(
      adminOrderListSchema
        .parse((await get("owner", `/v1/admin/orders?number=${tail}`)).body)
        .items.map((i) => i.number),
    ).toEqual([a.number]);
    expect(
      adminOrderListSchema
        .parse((await get("owner", `/v1/admin/orders?payment_type=przelew`)).body)
        .items.map((i) => i.number),
    ).toContain(b.number);
    // zakres dat w Europe/Warsaw: zamowienia z 2026-10-07 12:00 sa w dniu 07, nie w 06 ani 08
    expect(
      adminOrderListSchema.parse(
        (await get("owner", "/v1/admin/orders?from=2026-10-07&to=2026-10-07")).body,
      ).total,
    ).toBe(2);
    expect(
      adminOrderListSchema.parse((await get("owner", "/v1/admin/orders?to=2026-10-06")).body).total,
    ).toBe(0);
    expect(
      adminOrderListSchema.parse((await get("owner", "/v1/admin/orders?from=2026-10-08")).body)
        .total,
    ).toBe(0);
    const paged = await get("owner", "/v1/admin/orders?per_page=1&page=2&sort=number");
    expect(paged.body).toMatchObject({ page: 2, per_page: 1, total: 2 });
    expect(paged.body.items).toHaveLength(1);
    expect((await get("owner", "/v1/admin/orders?sort=contact_email")).status).toBe(400);
    expect((await get("owner", "/v1/admin/orders?status=zly")).status).toBe(400);
    expect((await t.http().get("/v1/admin/orders")).status).toBe(401);
  });

  it("B-202/B-208: szczegoly - pozycje, kwoty co do grosza, dostawa, platnosc, historia; viewer ma dane osobowe zamaskowane w odpowiedzi API", async () => {
    const nip = "5260250274";
    const o = await paidOrder({
      invoice: { nip, name: "Firma Przykladowa", address: "ul. Firmowa 2, 00-000 Warszawa" },
    });
    const owner = await get("owner", `/v1/admin/orders/${o.number}`);
    expect(owner.status).toBe(200);
    const d = adminOrderDetailSchema.parse(owner.body);
    expect(d).toMatchObject({
      number: o.number,
      status: "paid",
      items_gr: 133700,
      set_discount_gr: 13370,
      coupon_discount_gr: 0,
      shipping_gr: 0,
      total_gr: 120330,
      shipping_method: "kurier",
      payment: { type: "blik", status: "paid", attempts: 1 },
      contact: { email: "jan@taktyl.example", phone: "500000123" },
      shipping_address: {
        name: "Jan Przykładowy",
        street: "ul. Przykładowa 1",
        postcode: "00-000",
        city: "Warszawa",
      },
      allowed_transitions: ["processing", "cancelled"],
      internal_note: null,
      notes: [],
    });
    expect(d.items).toHaveLength(3);
    expect(d.items.reduce((s, i) => s + i.unit_price_gr * i.qty - i.set_discount_gr, 0)).toBe(
      120330,
    );
    expect(d.invoice).toMatchObject({ nip });
    expect(d.history.map((h) => `${h.from ?? "-"}>${h.to}`)).toEqual([
      "->pending_payment",
      "pending_payment>paid",
    ]);
    expect(d.history[1]).toMatchObject({ from: "pending_payment", to: "paid", actor: "system" });

    const editor = adminOrderDetailSchema.parse(
      (await get("editor", `/v1/admin/orders/${o.number}`)).body,
    );
    expect(editor.contact.email).toBe("jan@taktyl.example");

    const viewerRes = await get("viewer", `/v1/admin/orders/${o.number}`);
    expect(viewerRes.status).toBe(200);
    const v = adminOrderDetailSchema.parse(viewerRes.body);
    expect(v.contact).toEqual({ email: "j***@taktyl.example", phone: "+48 *** *** 123" });
    expect(v.shipping_address).toEqual({
      name: "J*** P***",
      street: "***",
      postcode: "**-***",
      city: "***",
    });
    expect(v.invoice).toMatchObject({ nip: "*******274", name: "F*** P***", address: "***" });
    expect(v.allowed_transitions).toEqual([]);
    const raw = JSON.stringify(viewerRes.body);
    for (const secret of [
      "jan@taktyl.example",
      "500000123",
      "Przykładowa",
      "Przykładowy",
      "Firmowa",
      nip,
    ]) {
      expect(raw).not.toContain(secret);
    }
    // kwoty bez zmian dla viewer
    expect(v.total_gr).toBe(120330);

    expect((await get("owner", "/v1/admin/orders/TK-261007-ZZZZ")).status).toBe(404);
    expect((await get("owner", "/v1/admin/orders/nie-numer")).status).toBe(400);
  });

  it("B-203: maszyna stanow - paid > processing > shipped > delivered; historia z autorem i wpis audit_log przed/po", async () => {
    const o = await paidOrder();
    const steps = ["processing", "shipped", "delivered"] as const;
    for (const to of steps) {
      const res = await post("editor", `/v1/admin/orders/${o.number}/transition`, {
        to,
        note: `krok ${to}`,
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(adminOrderDetailSchema.parse(res.body).status).toBe(to);
    }
    const d = adminOrderDetailSchema.parse(
      (await get("owner", `/v1/admin/orders/${o.number}`)).body,
    );
    expect(d.history.map((h) => h.to)).toEqual([
      "pending_payment",
      "paid",
      "processing",
      "shipped",
      "delivered",
    ]);
    expect(d.history[2]).toMatchObject({
      from: "paid",
      to: "processing",
      actor: accounts.editor.email,
      note: "krok processing",
    });
    expect(d.allowed_transitions).toEqual([]);
    const audit = await t.prisma.auditLog.findMany({
      where: { action: "order.transition", entityId: o.number },
      orderBy: { id: "asc" },
    });
    expect(audit).toHaveLength(3);
    expect(audit[1]?.before).toEqual({ status: "processing" });
    expect(audit[1]?.after).toEqual({ status: "shipped", note: "krok shipped" });
    expect(audit[0]?.actorRole).toBe("editor");
    // viewer widzi autora zamaskowanego
    const v = adminOrderDetailSchema.parse(
      (await get("viewer", `/v1/admin/orders/${o.number}`)).body,
    );
    expect(v.history[2]?.actor).toBe("e***@taktyl.example");
    // brak ruchow magazynowych i znacznikow przy zwyklych przejsciach
    expect(await t.prisma.stockMovement.count({ where: { kind: "sale_reverted" } })).toBe(0);
  });

  it("B-203: niedozwolone przejscia = 409 invalid_transition (problem+json), status bez zmian", async () => {
    const fresh = await createOrder();
    const failed = await createOrder();
    await pay(failed.number, failed.order_token, "failed");
    const paid = await paidOrder();
    const cases: [string, string, number][] = [
      [fresh.number, "processing", 409], // pending_payment > processing
      [fresh.number, "shipped", 409],
      [failed.number, "delivered", 409],
      [paid.number, "shipped", 409], // paid > shipped (pomija processing)
      [paid.number, "delivered", 409],
    ];
    for (const [number, to] of cases) {
      const res = await post("editor", `/v1/admin/orders/${number}/transition`, { to });
      expect(res.status, `${number} > ${to}`).toBe(409);
      expect(res.headers["content-type"]).toContain("application/problem+json");
      expect(problemSchema.parse(res.body)).toMatchObject({
        code: "invalid_transition",
        status: 409,
      });
    }
    expect(
      (await t.prisma.order.findUniqueOrThrow({ where: { number: paid.number } })).status,
    ).toBe("paid");
    // statusy ustawiane tylko przez system nie sa celem przejscia recznego (kontrakt)
    expect(
      (await post("editor", `/v1/admin/orders/${paid.number}/transition`, { to: "paid" })).status,
    ).toBe(422);
    expect(
      (await post("editor", `/v1/admin/orders/${paid.number}/transition`, { to: "payment_failed" }))
        .status,
    ).toBe(422);
    // stany koncowe: delivered i cancelled
    for (const to of ["processing", "shipped", "delivered"])
      await post("editor", `/v1/admin/orders/${paid.number}/transition`, { to });
    expect(
      (
        await post("editor", `/v1/admin/orders/${paid.number}/transition`, {
          to: "cancelled",
          note: "juz dostarczone",
        })
      ).status,
    ).toBe(409);
    expect(
      (await post("owner", `/v1/admin/orders/${paid.number}/transition`, { to: "processing" }))
        .status,
    ).toBe(409);
    expect(
      (await post("owner", `/v1/admin/orders/TK-261007-ZZZZ/transition`, { to: "processing" }))
        .status,
    ).toBe(404);
  });

  it("B-006/B-203: viewer nie zmienia statusu ani nie dodaje notatki (403), brak tokenu CSRF = 403 csrf_invalid", async () => {
    const o = await paidOrder();
    for (const [path, body] of [
      [`/v1/admin/orders/${o.number}/transition`, { to: "processing" }],
      [`/v1/admin/orders/${o.number}/note`, { note: "probuje" }],
    ] as const) {
      const res = await post("viewer", path, body);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("forbidden");
      const noCsrf = await t.http().post(path).set("Cookie", sessions.editor.cookie).send(body);
      expect(noCsrf.status).toBe(403);
      expect(noCsrf.body.code).toBe("csrf_invalid");
    }
    expect((await t.prisma.order.findUniqueOrThrow({ where: { number: o.number } })).status).toBe(
      "paid",
    );
    expect(await t.prisma.orderNote.count()).toBe(0);
  });

  it("B-205: anulowanie oplaconego zamowienia wymaga powodu, zwraca stany (ruch sale_reverted), jeden wpis w dzienniku i znaczniki outbox", async () => {
    const before = await stocks();
    const o = await paidOrder();
    const afterPay = await stocks();
    for (const sku of SET_SKUS) expect(afterPay[sku]).toBe((before[sku] as number) - 1);
    await t.prisma.outbox.deleteMany();

    const noReason = await post("editor", `/v1/admin/orders/${o.number}/transition`, {
      to: "cancelled",
    });
    expect(noReason.status).toBe(422);
    expect(noReason.body.errors[0]).toMatchObject({ path: "note" });
    expect(
      (
        await post("editor", `/v1/admin/orders/${o.number}/transition`, {
          to: "cancelled",
          note: "abc",
        })
      ).status,
    ).toBe(422);
    expect(await stocks()).toEqual(afterPay);

    const res = await post("editor", `/v1/admin/orders/${o.number}/transition`, {
      to: "cancelled",
      note: "Klient zrezygnowal",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(adminOrderDetailSchema.parse(res.body)).toMatchObject({
      status: "cancelled",
      allowed_transitions: [],
    });
    expect(await stocks()).toEqual(before);

    const editor = await t.prisma.adminUser.findUniqueOrThrow({
      where: { email: accounts.editor.email },
    });
    const moves = await t.prisma.stockMovement.findMany({
      where: { kind: "sale_reverted" },
      orderBy: { sku: "asc" },
    });
    expect(moves.map((m) => [m.sku, m.delta, m.orderNumber, m.actor, m.reason])).toEqual(
      [...SET_SKUS].sort().map((sku) => [sku, 1, o.number, editor.id, "Klient zrezygnowal"]),
    );
    for (const m of moves) expect(m.stockAfter).toBe(before[m.sku]);

    const audit = await t.prisma.auditLog.findMany({
      where: { action: "order.transition", entityId: o.number },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.before).toEqual({ status: "paid" });
    expect(audit[0]?.after).toMatchObject({
      status: "cancelled",
      note: "Klient zrezygnowal",
      restocked: [...SET_SKUS].sort().map((sku) => ({ sku, qty: 1 })),
    });

    const outbox = await t.prisma.outbox.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.status).toBe("pending");
    expect(outbox[0]?.auditId).toBe(audit[0]?.id);
    expect(outbox[0]?.tags).toEqual(
      expect.arrayContaining([
        "catalog",
        "category:klawiatury",
        "category:myszki",
        "category:podkladki",
        "facets:klawiatury",
        "product:bazalt-75",
      ]),
    );
    // druga proba anulowania: 409, stany nie rosna drugi raz
    expect(
      (
        await post("editor", `/v1/admin/orders/${o.number}/transition`, {
          to: "cancelled",
          note: "jeszcze raz",
        })
      ).status,
    ).toBe(409);
    expect(await stocks()).toEqual(before);
    // suma ruchow = stan wariantu (docs/17 par. 10)
    for (const sku of SET_SKUS) {
      const sum =
        (await t.prisma.stockMovement.aggregate({ where: { sku }, _sum: { delta: true } }))._sum
          .delta ?? 0;
      expect(sum).toBe(await stockOf(sku));
    }
  });

  it("B-205: anulowanie w realizacji zwraca stany, anulowanie nieoplaconego nie rusza magazynu ani outbox", async () => {
    const before = await stocks();
    const p = await paidOrder();
    await post("editor", `/v1/admin/orders/${p.number}/transition`, { to: "processing" });
    expect(
      (
        await post("owner", `/v1/admin/orders/${p.number}/transition`, {
          to: "cancelled",
          note: "brak kontaktu z klientem",
        })
      ).status,
    ).toBe(200);
    expect(await stocks()).toEqual(before);

    const n = await createOrder();
    await t.prisma.outbox.deleteMany();
    await t.prisma.stockMovement.deleteMany({ where: { kind: "sale_reverted" } });
    expect(
      (
        await post("editor", `/v1/admin/orders/${n.number}/transition`, {
          to: "cancelled",
          note: "nie oplacone",
        })
      ).status,
    ).toBe(200);
    expect(await stocks()).toEqual(before);
    expect(await t.prisma.stockMovement.count({ where: { kind: "sale_reverted" } })).toBe(0);
    expect(await t.prisma.outbox.count()).toBe(0);
    const f = await createOrder();
    await pay(f.number, f.order_token, "failed");
    expect(
      (
        await post("editor", `/v1/admin/orders/${f.number}/transition`, {
          to: "cancelled",
          note: "platnosc nieudana",
        })
      ).status,
    ).toBe(200);
    // anulowane zamowienie nie przyjmie platnosci
    const late = await t
      .http()
      .post(`/v1/orders/${n.number}/payment/simulate`)
      .set("X-Order-Token", n.order_token)
      .send({ outcome: "paid" });
    expect(late.status).toBe(409);
  });

  it("B-205: rownolegle anulowanie tego samego zamowienia przechodzi raz, stany wracaja raz", async () => {
    const before = await stocks();
    const o = await paidOrder();
    const results = await Promise.all(
      [1, 2, 3].map((i) =>
        post("editor", `/v1/admin/orders/${o.number}/transition`, {
          to: "cancelled",
          note: `proba ${i} anulowania`,
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(await stocks()).toEqual(before);
    expect(
      await t.prisma.stockMovement.count({
        where: { kind: "sale_reverted", orderNumber: o.number },
      }),
    ).toBe(3);
  });

  it("B-204: notatka wewnetrzna - autor i czas, w szczegolach admina, niewidoczna dla klienta, w dzienniku bez tresci", async () => {
    const o = await paidOrder();
    const res = await post("editor", `/v1/admin/orders/${o.number}/note`, {
      note: "  Dzwonic po 16:00  ",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const d = adminOrderDetailSchema.parse(res.body);
    expect(d.notes).toHaveLength(1);
    expect(d.notes[0]).toMatchObject({
      body: "Dzwonic po 16:00",
      author: accounts.editor.email,
      at: NOW.toISOString(),
    });
    expect(d.internal_note).toBe("Dzwonic po 16:00");
    await post("owner", `/v1/admin/orders/${o.number}/note`, { note: "Druga notatka" });
    const viewer = adminOrderDetailSchema.parse(
      (await get("viewer", `/v1/admin/orders/${o.number}`)).body,
    );
    expect(viewer.notes.map((n) => n.body)).toEqual(["Dzwonic po 16:00", "Druga notatka"]);
    expect(viewer.notes[0]?.author).toBe("e***@taktyl.example");

    const pub = await t.http().get(`/v1/orders/${o.number}`).set("X-Order-Token", o.order_token);
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.body)).not.toContain("Dzwonic");
    expect(JSON.stringify(pub.body)).not.toContain("notes");

    const audit = await t.prisma.auditLog.findMany({
      where: { action: "order.note", entityId: o.number },
      orderBy: { id: "asc" },
    });
    expect(audit).toHaveLength(2);
    expect(audit[0]?.after).toMatchObject({ chars: 16 });
    expect(JSON.stringify(audit.map((a) => ({ before: a.before, after: a.after })))).not.toContain(
      "Dzwonic",
    );

    expect((await post("editor", `/v1/admin/orders/${o.number}/note`, { note: "" })).status).toBe(
      422,
    );
    expect(
      (await post("editor", `/v1/admin/orders/${o.number}/note`, { note: "x".repeat(1001) }))
        .status,
    ).toBe(422);
    expect(
      (await post("editor", `/v1/admin/orders/${o.number}/note`, { note: "ok", extra: 1 })).status,
    ).toBe(422);
    expect(
      (await post("editor", `/v1/admin/orders/TK-261007-ZZZZ/note`, { note: "nic" })).status,
    ).toBe(404);
  });

  it("B-011: dziennik zamowien nie zawiera danych osobowych klienta ani hasel", async () => {
    const o = await paidOrder();
    await post("editor", `/v1/admin/orders/${o.number}/note`, { note: "tel. 500000123" });
    await post("editor", `/v1/admin/orders/${o.number}/transition`, {
      to: "processing",
      note: "pakowanie",
    });
    const dump = JSON.stringify(
      await t.prisma.auditLog.findMany({
        select: { action: true, entity: true, entityId: true, before: true, after: true },
      }),
    );
    for (const pii of ["jan@taktyl.example", "500000123", "Przykładow", "Warszawa", "argon2"])
      expect(dump).not.toContain(pii);
  });

  it("B-209: retencja - po 30 dniach pola osobowe puste, numer, kwoty i pozycje zostaja; wpis w dzienniku", async () => {
    const o = await paidOrder();
    const young = new Date(now.getTime() + 29 * 86_400_000);
    now = young;
    const svc = t.app.get(OrderRetentionService);
    expect(await svc.purge()).toBe(0);
    expect(
      (await t.prisma.order.findUniqueOrThrow({ where: { number: o.number } })).contactEmail,
    ).toBe("jan@taktyl.example");

    now = new Date(NOW.getTime() + 31 * 86_400_000);
    expect(await svc.purge()).toBe(1);
    expect(await svc.purge()).toBe(0); // idempotentne
    now = new Date(NOW); // sesje backpanelu wygasly by po 31 dniach: dalsze zapytania z czasem logowania
    const row = await t.prisma.order.findUniqueOrThrow({
      where: { number: o.number },
      include: { items: true },
    });
    expect([row.contactEmail, row.contactPhone, row.shippingAddress, row.invoice]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(row).toMatchObject({ number: o.number, totalGr: 120330, status: "paid" });
    expect(row.items).toHaveLength(3);
    const d = adminOrderDetailSchema.parse(
      (await get("owner", `/v1/admin/orders/${o.number}`)).body,
    );
    expect(d.contact).toEqual({ email: "", phone: "" });
    expect(d.shipping_address).toBeNull();
    expect(
      adminOrderListSchema.parse((await get("owner", "/v1/admin/orders")).body).items[0]
        ?.contact_email,
    ).toBe("");
    const audit = await t.prisma.auditLog.findMany({ where: { action: "orders.retention_purge" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorRole: "system", actorId: null });
    expect(audit[0]?.after).toMatchObject({ count: 1 });
  });
});
