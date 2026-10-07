// B-600..B-607 (TAKTYL-64): pulpit na PostgreSQL - liczby zamowien i przychod z bazy, niskie stany z seeda, postep zdjec P0,
// ostatnie zmiany z audit_log, kolejka outbox; odczyt dla kazdej roli, viewer z zamaskowanym autorem.
import { randomUUID } from "node:crypto";
import { dashboardSchema, orderCreatedSchema } from "@taktyl/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addUser, login, type LoggedIn, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, NOW, reseed, type TestEnv } from "./helpers.js";

type Role = "owner" | "editor" | "viewer";

const SET = {
  type: "set",
  id: "set-1696676400000",
  qty: 1,
  profile: "programowanie",
  skus: ["K-BZL75-GRF-PRG", "M-PST-GRF", "P-SZR-XL-GRF"],
};
const orderBody = {
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
};

describe.skipIf(!hasDb)("B-600..B-607 pulpit (PostgreSQL)", () => {
  let t: TestEnv;
  let now = new Date(NOW);
  let shifted = 0;
  const accounts: Record<Role, { email: string; password: string }> = {
    owner: { email: "wlasciciel@taktyl.example", password: pw() },
    editor: { email: "edytor@taktyl.example", password: pw() },
    viewer: { email: "podglad@taktyl.example", password: pw() },
  };
  const sessions = {} as Record<Role, LoggedIn>;

  beforeAll(async () => {
    t = await bootApp({ clock: () => now });
    await resetAuth(t.prisma);
    let n = 0;
    for (const [role, a] of Object.entries(accounts) as [Role, (typeof accounts)[Role]][]) {
      await addUser(t.prisma, a.email, role, a.password);
      sessions[role] = await login(t, a.email, a.password, `10.8.0.${++n}`);
    }
  });
  afterAll(async () => {
    await resetAuth(t.prisma);
    await t.close();
  });
  let logins = 0;
  const loginAll = async () => {
    for (const [role, a] of Object.entries(accounts) as [Role, (typeof accounts)[Role]][]) {
      sessions[role] = await login(t, a.email, a.password, `10.8.2.${++logins}`);
    }
  };
  beforeEach(async () => {
    if (shifted > 0) {
      // logowanie po przesunieciu zegara czysci stare sesje, wiec wracamy do chwili NOW i logujemy konta od nowa
      shifted = 0;
      now = new Date(NOW);
      await loginAll();
    }
    now = new Date(NOW);
    await reseed(t.prisma);
    await t.prisma.$executeRawUnsafe(`TRUNCATE TABLE "outbox", "audit_log" RESTART IDENTITY`);
  });

  const dash = async (role: Role) => {
    const res = await t.http().get("/v1/admin/dashboard").set("Cookie", sessions[role].cookie);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return dashboardSchema.parse(res.body);
  };

  it("B-602, B-605: po seedzie niskie stany z docs, brak zamowien, zdjecia 0 z 76, pusty dziennik", async () => {
    const d = await dash("viewer");
    expect(d.low_stock.items.map((i) => [i.sku, i.stock])).toEqual([
      ["K-BZL75-KOB-SZP", 0],
      ["P-LOD-L-MGL", 0],
      ["M-JRZ-MGL", 2],
      ["K-KRD98-GRF-TRZ", 3],
    ]);
    expect(d.low_stock.count).toBe(4);
    expect(d.low_stock.out_of_stock_count).toBe(2);
    expect(d.low_stock.items[0]).toMatchObject({
      product_slug: expect.any(String),
      product_name: expect.any(String),
    });
    expect(d.orders).toEqual({
      today: 0,
      last_7_days: 0,
      last_30_days: 0,
      total: 0,
      by_status: {},
    });
    expect(d.revenue).toEqual({ paid_7_days_gr: 0, paid_30_days_gr: 0 });
    expect(d.orders_to_handle).toEqual([]);
    expect(d.images_p0).toEqual({ ready: 0, total: 76 });
    expect(d.recent_changes).toEqual([]);
    expect(d.connection).toEqual({
      outbox_pending: 0,
      outbox_failed: 0,
      last_revalidated_at: null,
    });
  });

  // Sesje maja idle 30 min i TTL 12 h liczone zegarem testu, wiec po przesunieciu zegara logujemy nowe konto.
  const dashAfter = async (ms: number) => {
    now = new Date(NOW.getTime() + ms);
    const email = `czas${++shifted}@taktyl.example`;
    const password = pw();
    await addUser(t.prisma, email, "owner", password);
    const s = await login(t, email, password, `10.8.1.${shifted}`);
    const res = await t.http().get("/v1/admin/dashboard").set("Cookie", s.cookie);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return dashboardSchema.parse(res.body);
  };

  it("B-600, B-601, B-604: zamowienie rosnie o 1, przychod z oplaconych, reakcja po 24 h", async () => {
    const created = orderCreatedSchema.parse(
      (await t.http().post("/v1/orders").set("Idempotency-Key", randomUUID()).send(orderBody)).body,
    );
    let d = await dash("editor");
    expect(d.orders).toMatchObject({
      today: 1,
      last_7_days: 1,
      last_30_days: 1,
      total: 1,
      by_status: { pending_payment: 1 },
    });
    expect(d.revenue.paid_7_days_gr).toBe(0);

    const paid = await t
      .http()
      .post(`/v1/orders/${created.number}/payment/simulate`)
      .set("X-Order-Token", created.order_token)
      .send({ outcome: "paid" });
    expect(paid.status, JSON.stringify(paid.body)).toBe(200);
    d = await dash("owner");
    expect(d.orders.by_status).toEqual({ paid: 1 });
    expect(d.revenue).toEqual({ paid_7_days_gr: 120330, paid_30_days_gr: 120330 });
    expect(d.orders_to_handle).toEqual([]);

    d = await dashAfter(25 * 3_600_000);
    expect(d.orders_to_handle.map((o) => [o.number, o.total_gr])).toEqual([
      [created.number, 120330],
    ]);
    expect(d.orders.today).toBe(0);
    expect(d.orders.last_7_days).toBe(1);

    d = await dashAfter(8 * 86_400_000);
    expect(d.orders.last_7_days).toBe(0);
    expect(d.orders.last_30_days).toBe(1);
    expect(d.revenue).toEqual({ paid_7_days_gr: 0, paid_30_days_gr: 120330 });
  });

  it("B-603, B-606: ostatnie zmiany z dziennika (max 10) i kolejka outbox; viewer widzi zamaskowanego autora", async () => {
    const owner = sessions.owner;
    for (let i = 0; i < 12; i += 1) {
      const res = await t
        .http()
        .put("/v1/admin/variants/M-WRB-GRF/stock")
        .set("Cookie", owner.cookie)
        .set("X-CSRF-Token", owner.csrf)
        .send({ stock: 20 + i, reason: "korekta" });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    }
    const asOwner = await dash("owner");
    expect(asOwner.recent_changes).toHaveLength(10);
    expect(asOwner.recent_changes[0]?.entity).toBeTruthy();
    expect(asOwner.recent_changes[0]?.actor_label).toBe(accounts.owner.email);
    expect(asOwner.connection.outbox_pending + asOwner.connection.outbox_failed).toBeGreaterThan(0);

    const asViewer = await dash("viewer");
    expect(asViewer.recent_changes[0]?.actor_label).not.toBe(accounts.owner.email);
    expect(asViewer.recent_changes[0]?.actor_label).toContain("***");
    expect(JSON.stringify(asViewer)).not.toContain(accounts.owner.email);
  });

  it("B-605: postep P0 rosnie po wgraniu zdjecia (status gotowe w bazie)", async () => {
    await t.prisma.productImage.update({
      where: { key: "k-kwarc-60_grafit_top" },
      data: { status: "gotowe" },
    });
    expect((await dash("viewer")).images_p0).toEqual({ ready: 1, total: 76 });
  });

  it("wszystkie role czytaja, bez sesji 401", async () => {
    for (const role of ["owner", "editor", "viewer"] as const) await dash(role);
    expect((await t.http().get("/v1/admin/dashboard")).status).toBe(401);
  });
});
