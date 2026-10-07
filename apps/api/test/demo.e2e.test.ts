// B-014, S32 (docs/12 par. 7), I-009 (TAKTYL-65): reset danych demo z backpanelu (PostgreSQL).
// Owner + DEMO_MODE: dane wracaja do seeda, konta i sesje zostaja, audit i outbox z komplem znacznikow; poza demo 404;
// sufity limitow DEMO_THROTTLE_* dzialaja tylko w DEMO_MODE.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, login, type LoggedIn, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, type TestEnv } from "./helpers.js";

const accounts = {
  owner: { email: "wlasciciel@taktyl.example", password: pw() },
  editor: { email: "edytor@taktyl.example", password: pw() },
};

async function bootWithAccounts(env: Record<string, string>, rateLimit = false) {
  const t = await bootApp({ env, rateLimit });
  await resetAuth(t.prisma);
  await addUser(t.prisma, accounts.owner.email, "owner", accounts.owner.password);
  await addUser(t.prisma, accounts.editor.email, "editor", accounts.editor.password);
  return t;
}

describe.skipIf(!hasDb)("B-014 reset danych demo (PostgreSQL)", () => {
  describe("DEMO_MODE=true", () => {
    let t: TestEnv;
    let owner: LoggedIn;
    let editor: LoggedIn;
    beforeAll(async () => {
      t = await bootWithAccounts({ DEMO_MODE: "true" });
      owner = await login(t, accounts.owner.email, accounts.owner.password, "10.7.0.1");
      editor = await login(t, accounts.editor.email, accounts.editor.password, "10.7.0.2");
    });
    afterAll(async () => {
      await resetAuth(t.prisma);
      await t.close();
    });
    const reset = (who: LoggedIn, body: object = { confirm: "reset" }) =>
      t
        .http()
        .post("/v1/admin/demo/reset")
        .set("Cookie", who.cookie)
        .set("X-CSRF-Token", who.csrf)
        .send(body);

    it("S32: po zmianie ceny, stanu i zgloszen reset przywraca seed; konta i sesja zostaja", async () => {
      const seedVariants = await t.prisma.variant.findMany({ orderBy: { sku: "asc" } });
      const seedPrice = seedVariants.find((v) => v.sku === "M-WRB-GRF")!.priceGr;
      await t.prisma.variant.update({ where: { sku: "M-WRB-GRF" }, data: { priceGr: 99900 } });
      await t.prisma.variant.update({ where: { sku: "M-WRB-GRF" }, data: { stock: 1 } });
      await t.prisma.contactMessage.create({
        data: { email: "x@taktyl.example", subject: "Test", body: "Wiadomosc" },
      });

      const res = await reset(owner);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body).toMatchObject({ status: "reset" });

      const after = await t.prisma.variant.findMany({ orderBy: { sku: "asc" } });
      expect(after).toHaveLength(seedVariants.length);
      expect(after.find((v) => v.sku === "M-WRB-GRF")!.priceGr).toBe(seedPrice);
      expect(after.map((v) => [v.sku, v.priceGr, v.stock])).toEqual(
        seedVariants.map((v) => [v.sku, v.priceGr, v.stock]),
      );
      expect(await t.prisma.product.count()).toBe(18);
      expect(await t.prisma.contactMessage.count()).toBe(0);
      expect(await t.prisma.adminUser.count()).toBe(2);
      const me = await t.http().get("/v1/admin/auth/me").set("Cookie", owner.cookie);
      expect(me.status).toBe(200);
    });

    it("po resecie: wpis demo.reset w audit_log (owner) i outbox z kompletem znacznikow sklepu", async () => {
      const res = await reset(owner);
      expect(res.status).toBe(200);
      const audit = await t.prisma.auditLog.findMany({ where: { action: "demo.reset" } });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ actorRole: "owner", entity: "demo" });
      expect(audit[0]!.actorId).not.toBeNull();
      const rows = await t.prisma.outbox.findMany();
      expect(rows).toHaveLength(1);
      const tags = rows[0]!.tags;
      expect(tags).toEqual(
        expect.arrayContaining([
          "catalog",
          "presets",
          "rules",
          "shop-settings",
          "content:guide",
          "category:klawiatury",
          "product:wrobel",
        ]),
      );
      expect(rows[0]).toMatchObject({ status: "pending", auditId: audit[0]!.id });
    });

    it("tylko owner i tylko z potwierdzeniem: editor 403, brak lub zle slowo 422, bez CSRF 403", async () => {
      expect((await reset(editor)).status).toBe(403);
      expect((await reset(owner, {})).status).toBe(422);
      expect((await reset(owner, { confirm: "tak" })).status).toBe(422);
      const noCsrf = await t.http().post("/v1/admin/demo/reset").set("Cookie", owner.cookie).send({ confirm: "reset" });
      expect(noCsrf.status).toBe(403);
      expect((await t.http().post("/v1/admin/demo/reset").send({ confirm: "reset" })).status).toBe(401);
    });
  });

  describe("DEMO_MODE=false", () => {
    let t: TestEnv;
    let owner: LoggedIn;
    beforeAll(async () => {
      t = await bootWithAccounts({});
      owner = await login(t, accounts.owner.email, accounts.owner.password, "10.7.1.1");
    });
    afterAll(async () => {
      await resetAuth(t.prisma);
      await t.close();
    });
    it("endpoint zwraca 404, dane nietkniete", async () => {
      await t.prisma.variant.update({ where: { sku: "M-WRB-GRF" }, data: { priceGr: 99900 } });
      const res = await t
        .http()
        .post("/v1/admin/demo/reset")
        .set("Cookie", owner.cookie)
        .set("X-CSRF-Token", owner.csrf)
        .send({ confirm: "reset" });
      expect(res.status).toBe(404);
      expect((await t.prisma.variant.findUniqueOrThrow({ where: { sku: "M-WRB-GRF" } })).priceGr).toBe(99900);
    });
  });

  describe("limity DEMO_THROTTLE_*", () => {
    const hit = (t: TestEnv, ip: string) =>
      t.http().post("/v1/forms/newsletter").set("X-Forwarded-For", ip).send({ email: "a@taktyl.example" });
    it("w DEMO_MODE zapisy sa ograniczone sufitem (2/min), poza demo obowiazuje limit bazowy (5/min)", async () => {
      const demo = await bootWithAccounts({ DEMO_MODE: "true", DEMO_THROTTLE_WRITE_LIMIT: "2" }, true);
      try {
        const codes = [];
        for (let i = 0; i < 3; i++) codes.push((await hit(demo, "10.7.2.1")).status);
        expect(codes).toEqual([201, 201, 429]);
      } finally {
        await resetAuth(demo.prisma);
        await demo.close();
      }
      const plain = await bootWithAccounts({ DEMO_THROTTLE_WRITE_LIMIT: "2" }, true);
      try {
        const codes = [];
        for (let i = 0; i < 4; i++) codes.push((await hit(plain, "10.7.2.2")).status);
        expect(codes).toEqual([201, 201, 201, 201]);
      } finally {
        await resetAuth(plain.prisma);
        await plain.close();
      }
    });
  });
});
