// B-400..B-408 (TAKTYL-49): ustawienia sklepu w backpanelu na PostgreSQL - odczyt, zapis tylko owner (If-Match), zakresy i spojnosc,
// kody rabatowe, punkty odbioru, etykieta demo, dane firmy, znaczniki shop-settings (+ presets, catalog przy rabacie setu), audyt.
import { adminSettingsSchema } from "@taktyl/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addUser, login, type LoggedIn, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, reseed, type TestEnv } from "./helpers.js";

type Role = "owner" | "editor" | "viewer";
type Method = "get" | "patch";

const BRAND = "MarkaTestowa";

describe.skipIf(!hasDb)("B-400..B-408 ustawienia sklepu (PostgreSQL)", () => {
  let t: TestEnv;
  const accounts: Record<Role, { email: string; password: string }> = {
    owner: { email: "wlasciciel@taktyl.example", password: pw() },
    editor: { email: "edytor@taktyl.example", password: pw() },
    viewer: { email: "podglad@taktyl.example", password: pw() },
  };
  const sessions = {} as Record<Role, LoggedIn>;

  beforeAll(async () => {
    t = await bootApp({ env: { FORBIDDEN_BRANDS: `${BRAND}, Inna Marka` } });
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
  beforeEach(async () => {
    await reseed(t.prisma);
    await t.prisma.$executeRawUnsafe(`TRUNCATE TABLE "outbox", "audit_log" RESTART IDENTITY`);
  });

  const call = (
    role: Role,
    method: Method,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    let r = t.http()[method]("/v1/admin/settings").set("Cookie", sessions[role].cookie);
    if (method !== "get") r = r.set("X-CSRF-Token", sessions[role].csrf);
    for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
    return body === undefined ? r : r.send(body as object);
  };
  const current = async () => {
    const res = await call("viewer", "get");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return adminSettingsSchema.parse(res.body);
  };
  /** PATCH jako owner z aktualna wersja. */
  const patch = async (body: object, version?: number, role: Role = "owner") =>
    call(role, "patch", body, { "If-Match": `"${version ?? (await current()).version}"` });
  const outbox = () => t.prisma.outbox.findMany({ orderBy: { id: "asc" } });
  const audits = () => t.prisma.auditLog.findMany({ where: { action: "settings.update" } });

  it("odczyt: pelne ustawienia z kodami i nieaktywnymi pozycjami, ETag = wersja; viewer i editor czytaja", async () => {
    for (const role of ["viewer", "editor", "owner"] as Role[]) {
      const res = await call(role, "get");
      expect(res.status).toBe(200);
      expect(res.headers["etag"]).toBe('"1"');
    }
    const s = await current();
    expect(s).toMatchObject({
      free_shipping_threshold_gr: 29900,
      set_discount: { percent: 10 },
      dispatch_cutoff_hour: 14,
      version: 1,
    });
    expect(s.discount_codes.map((c) => c.code)).toEqual(["DOSTAWA0", "TAKTYL10"]);
    expect(s.discount_codes.find((c) => c.code === "TAKTYL10")).toMatchObject({
      type: "percent",
      value: 10,
      active: true,
    });
    expect(s.shipping_methods.map((m) => m.id)).toEqual(["automat", "kurier", "odbior"]);
    expect(s.pickup_points).toHaveLength(6);
    // publiczny widok nie ma logiki kodow
    const pub = await t.http().get("/v1/shop-settings");
    expect(JSON.stringify(pub.body.discount_codes)).not.toContain("percent");
  });

  it("zapis tylko owner: editor i viewer dostaja 403, brak sesji 401; nic sie nie zapisuje", async () => {
    for (const role of ["editor", "viewer"] as Role[]) {
      const res = await call(
        role,
        "patch",
        { free_shipping_threshold_gr: 1 },
        { "If-Match": '"1"' },
      );
      expect(res.status, role).toBe(403);
      expect(res.body.code).toBe("forbidden");
    }
    expect(
      (await t.http().patch("/v1/admin/settings").send({ free_shipping_threshold_gr: 1 })).status,
    ).toBe(401);
    expect((await current()).free_shipping_threshold_gr).toBe(29900);
    expect(await outbox()).toHaveLength(0);
    expect(await audits()).toHaveLength(0);
  });

  it("If-Match: 412 przy starej wersji, 428 bez naglowka, 422 przy zlym formacie; ETag rosnie", async () => {
    const ok = await patch({ free_shipping_threshold_gr: 39900 });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.headers["etag"]).toBe('"2"');
    expect(ok.body.version).toBe(2);
    expect((await patch({ free_shipping_threshold_gr: 49900 }, 1)).status).toBe(412);
    expect((await call("owner", "patch", { free_shipping_threshold_gr: 1 })).status).toBe(428);
    expect(
      (await call("owner", "patch", { free_shipping_threshold_gr: 1 }, { "If-Match": "x" })).status,
    ).toBe(422);
    expect((await current()).free_shipping_threshold_gr).toBe(39900);
  });

  it("B-400: prog darmowej dostawy w groszach - widoczny w sklepie i w wycenie; audyt przed -> po; znacznik shop-settings", async () => {
    const quote = () =>
      t
        .http()
        .post("/v1/cart/quote")
        .send({ items: [{ type: "item", sku: "P-TFL-M-GRF", qty: 1 }] });
    const before = (await quote()).body.summary.free_shipping_remaining_gr as number;
    const res = await patch({ free_shipping_threshold_gr: 39900 });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.free_shipping_threshold_gr).toBe(39900);
    expect((await t.http().get("/v1/shop-settings")).body.free_shipping_threshold_gr).toBe(39900);
    expect((await quote()).body.summary.free_shipping_remaining_gr).toBe(before + 10000);
    const [a] = await audits();
    expect(a).toMatchObject({
      entity: "settings",
      entityId: "default",
      actorRole: "owner",
      before: { free_shipping_threshold_gr: 29900 },
      after: { free_shipping_threshold_gr: 39900 },
    });
    const out = await outbox();
    expect(out).toHaveLength(1);
    expect(out[0]!.tags).toEqual(["shop-settings"]);
    expect(out[0]!.auditId).toBe(a!.id);
    for (const bad of [-1, 12.5, "x"]) {
      expect((await patch({ free_shipping_threshold_gr: bad })).status).toBe(422);
    }
  });

  it("B-401: rabat setu 0-50 % i trzy kategorie; zmiana przelicza ceny setow i dodaje znaczniki presets i catalog", async () => {
    const before = (await t.http().get("/v1/presets")).body.items.find(
      (i: { id: string }) => i.id === "programista",
    );
    expect(before).toMatchObject({ sum_gr: 133700, set_discount_gr: 13370, total_gr: 120330 });
    const res = await patch({
      set_discount: { percent: 15, categories: ["klawiatury", "myszki", "podkladki"] },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = (await t.http().get("/v1/presets")).body.items.find(
      (i: { id: string }) => i.id === "programista",
    );
    expect(after).toMatchObject({ set_discount_gr: 20055, total_gr: 113645 });
    expect((await outbox())[0]!.tags).toEqual(["catalog", "presets", "shop-settings"]);
    expect((await audits())[0]).toMatchObject({
      before: { set_discount: { percent: 10 } },
      after: { set_discount: { percent: 15 } },
    });
    expect(
      (
        await patch({
          set_discount: { percent: 0, categories: ["klawiatury", "myszki", "podkladki"] },
        })
      ).status,
    ).toBe(200);
    for (const bad of [
      { percent: 51, categories: ["klawiatury", "myszki", "podkladki"] },
      { percent: -1, categories: ["klawiatury", "myszki", "podkladki"] },
      { percent: 10.5, categories: ["klawiatury", "myszki", "podkladki"] },
      { percent: 10, categories: ["klawiatury", "klawiatury", "myszki"] },
      { percent: 10, categories: ["klawiatury", "myszki"] },
    ]) {
      const r = await patch({ set_discount: bad });
      expect(r.status, JSON.stringify(bad)).toBe(422);
    }
  });

  it("bez zmiany wartosci: brak podbicia wersji, audytu i outboxa", async () => {
    const s = await current();
    const res = await patch(
      {
        free_shipping_threshold_gr: s.free_shipping_threshold_gr,
        set_discount: s.set_discount,
        dispatch_cutoff_hour: s.dispatch_cutoff_hour,
      },
      s.version,
    );
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(await audits()).toHaveLength(0);
    expect(await outbox()).toHaveLength(0);
  });

  it("B-402: metody dostawy - cena i pola kasy w sklepie; spojnosc pol (adres razem, punkt bez adresu), nazwy bez marek, min. jedna aktywna", async () => {
    const s = await current();
    const kurier = s.shipping_methods.find((m) => m.id === "kurier")!;
    const automat = s.shipping_methods.find((m) => m.id === "automat")!;
    const ok = await patch({
      shipping_methods: [{ ...kurier, price_gr: 1899, label: "Kurier  " }],
    });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const pub = (await t.http().get("/v1/shop-settings")).body.shipping_methods;
    expect(pub.find((m: { id: string }) => m.id === "kurier")).toMatchObject({
      price_gr: 1899,
      label: "Kurier",
    });
    expect(pub.find((m: { id: string }) => m.id === "automat").fields).toEqual([
      "email",
      "phone",
      "point",
    ]);

    const code = async (m: object) => {
      const r = await patch({ shipping_methods: [m] });
      expect(r.status, JSON.stringify(m)).toBe(422);
      return r.body.errors.map((e: { code: string }) => e.code);
    };
    expect(
      await code({ ...kurier, fields: ["email", "phone", "name", "street", "city"] }),
    ).toContain("incomplete_address");
    expect(await code({ ...kurier, fields: [...kurier.fields, "point"] })).toContain(
      "point_with_address",
    );
    expect(await code({ ...automat, fields: ["email", "phone"] })).toContain("point_required");
    expect(await code({ ...automat, fields: ["phone", "point"] })).toContain("contact_required");
    expect(await code({ ...kurier, fields: ["email", "phone", "name"] })).toContain(
      "address_required",
    );
    expect(await code({ ...kurier, label: `${BRAND} Express` })).toContain("real_brand");
    expect(await code({ ...kurier, label: "   " })).toContain("required");
    expect(await code({ ...kurier, address: "ul. Prawdziwa 1, 31-001 Krakow" })).toContain(
      "not_fictional",
    );
    expect(
      await code({ ...kurier, address: "ul. Przykladowa 1, 31-001 Krakow (adres fikcyjny)" }),
    ).toContain("invalid_postcode");
    // duplikat w jednym zadaniu i wylaczenie wszystkich metod
    const dupRes = await patch({ shipping_methods: [kurier, kurier] });
    expect(dupRes.status).toBe(422);
    const all = await patch({
      shipping_methods: s.shipping_methods.map((m) => ({ ...m, active: false })),
    });
    expect(all.status).toBe(422);
    expect(all.body.errors.map((e: { code: string }) => e.code)).toContain("no_active_method");
    expect((await current()).shipping_methods.filter((m) => m.active)).toHaveLength(3);
    // wylaczona metoda znika z publicznych ustawien
    const off = await patch({ shipping_methods: [{ ...kurier, active: false }] });
    expect(off.status).toBe(200);
    expect(
      (await t.http().get("/v1/shop-settings")).body.shipping_methods.map(
        (m: { id: string }) => m.id,
      ),
    ).toEqual(["automat", "odbior"]);
  });

  it("B-403: metody platnosci - wylaczona znika z kasy, wszystkie wylaczone = 422, nazwa z marka = 422", async () => {
    const s = await current();
    const blik = s.payment_methods.find((m) => m.id === "blik")!;
    const off = await patch({ payment_methods: [{ ...blik, active: false }] });
    expect(off.status, JSON.stringify(off.body)).toBe(200);
    expect(
      (await t.http().get("/v1/shop-settings")).body.payment_methods.map(
        (m: { id: string }) => m.id,
      ),
    ).toEqual(["karta", "przelew-online", "przelew"]);
    const all = await patch({
      payment_methods: s.payment_methods.map((m) => ({ ...m, active: false })),
    });
    expect(all.status).toBe(422);
    expect(all.body.errors.map((e: { code: string }) => e.code)).toContain("no_active_method");
    const brand = await patch({ payment_methods: [{ ...blik, label: `${BRAND} Pay` }] });
    expect(brand.status).toBe(422);
    expect(
      (await patch({ payment_methods: [{ id: "gotowka", label: "Gotowka", active: true }] }))
        .status,
    ).toBe(422);
  });

  it("B-404: kody rabatowe - unikalne, 4-20 znakow, procent z wartoscia; nowy kod dziala w wycenie, usuniety przestaje", async () => {
    const s = await current();
    const base = s.discount_codes;
    const nowy = {
      code: "NOWY15",
      type: "percent" as const,
      value: 15,
      scope: "pozycje spoza setow",
      label: "-15% na produkty spoza setow",
      active: true,
      valid_from: null,
      valid_to: null,
    };
    const ok = await patch({
      discount_codes: [...base.filter((c) => c.code !== "DOSTAWA0"), nowy],
    });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.discount_codes.map((c: { code: string }) => c.code)).toEqual([
      "NOWY15",
      "TAKTYL10",
    ]);
    const quote = async (coupon: string) =>
      (
        await t
          .http()
          .post("/v1/cart/quote")
          .send({ items: [{ type: "item", sku: "P-TFL-XL-GRF", qty: 1 }], coupon })
      ).body;
    expect((await quote("NOWY15")).summary.coupon_discount_gr).toBe(2235);
    expect((await quote("DOSTAWA0")).coupon).toMatchObject({ applied: false });
    const [a] = await audits();
    expect(Object.keys(a!.after as object)).toEqual(["discount_codes"]);
    expect((await outbox())[0]!.tags).toEqual(["shop-settings"]);

    const code = async (codes: object[]) => {
      const r = await patch({ discount_codes: codes });
      expect(r.status, JSON.stringify(codes)).toBe(422);
      return r.body.errors.map((e: { code: string }) => e.code);
    };
    expect(await code([nowy, nowy])).toContain("duplicate_code");
    expect(await code([{ ...nowy, code: "AB" }])).toContain("invalid_length");
    expect(await code([{ ...nowy, code: "A".repeat(21) }])).toContain("invalid_length");
    expect(await code([{ ...nowy, value: null }])).toContain("value_required");
    expect(await code([{ ...nowy, type: "free_shipping", value: 10 }])).toContain(
      "value_not_allowed",
    );
    expect(
      await code([
        { ...nowy, valid_from: "2026-12-01T00:00:00+01:00", valid_to: "2026-11-01T00:00:00+01:00" },
      ]),
    ).toContain("invalid_range");
    expect(await code([{ ...nowy, label: `${BRAND} -15%` }])).toContain("real_brand");
    expect((await patch({ discount_codes: [{ ...nowy, code: "male" }] })).status).toBe(422);
    expect((await patch({ discount_codes: [{ ...nowy, value: 91 }] })).status).toBe(422);
    // wylaczony kod nie dziala
    const off = await patch({ discount_codes: [{ ...nowy, active: false }] });
    expect(off.status).toBe(200);
    expect((await quote("NOWY15")).coupon).toMatchObject({ applied: false });
    // pusta lista = brak kodow
    expect((await patch({ discount_codes: [] })).body.discount_codes).toEqual([]);
  });

  it("B-405: punkty odbioru - fikcyjne lokalizacje, kod 00-000, miasto, unikalnosc; nowy punkt w sklepie, wylaczony znika", async () => {
    const s = await current();
    const nowy = {
      id: "SZC-001",
      city: "Szczecin",
      label: "SZC-001 · bulwar (lokalizacja fikcyjna)",
      active: true,
    };
    const ok = await patch({ pickup_points: [...s.pickup_points, nowy] });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.pickup_points).toHaveLength(7);
    const pub = await t.http().get("/v1/pickup-points?city=szczecin");
    expect(pub.body.items.map((p: { id: string }) => p.id)).toEqual(["SZC-001"]);
    const off = await patch({ pickup_points: [...s.pickup_points, { ...nowy, active: false }] });
    expect(off.status).toBe(200);
    expect((await t.http().get("/v1/pickup-points?city=szczecin")).body.items).toEqual([]);

    const code = async (pts: object[]) => {
      const r = await patch({ pickup_points: pts });
      expect(r.status, JSON.stringify(pts)).toBe(422);
      return r.body.errors.map((e: { code: string }) => e.code);
    };
    expect(await code([{ ...nowy, label: "SZC-001 · ul. Prawdziwa 1" }])).toContain(
      "not_fictional",
    );
    expect(
      await code([{ ...nowy, label: "SZC-001 · 70-001 Szczecin (lokalizacja fikcyjna)" }]),
    ).toContain("invalid_postcode");
    expect(await code([{ ...nowy, city: "  " }])).toContain("required");
    expect(await code([nowy, nowy])).toContain("duplicate");
    expect(await code([{ ...nowy, label: `${BRAND} · punkt (lokalizacja fikcyjna)` }])).toContain(
      "real_brand",
    );
    expect((await patch({ pickup_points: [{ ...nowy, id: "szc-1" }] })).status).toBe(422);
  });

  it("B-406: etykieta demo nie moze byc pusta ani pomijac slowa demo; zmiana trafia do sklepu", async () => {
    for (const label of ["", "   ", "Witamy w sklepie"]) {
      const r = await patch({ demo: { label } });
      expect(r.status, label).toBe(422);
    }
    expect((await patch({ demo: { label: `${BRAND} to sklep demonstracyjny` } })).status).toBe(422);
    const ok = await patch({
      demo: { label: "  Taktyl to sklep demonstracyjny. Zamowienia sa symulacja.  " },
    });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect((await t.http().get("/v1/shop-settings")).body.demo.label).toBe(
      "Taktyl to sklep demonstracyjny. Zamowienia sa symulacja.",
    );
  });

  it("B-407: godzina graniczna wysylki 0-23 wplywa na termin (12:00 Warszawa: przed 14 wysylka dzis, po zmianie na 10 juz nie)", async () => {
    const estimate = async () => (await t.http().get("/v1/shipping-estimate?method=kurier")).body;
    expect((await estimate()).dispatches_today).toBe(true);
    expect((await patch({ dispatch_cutoff_hour: 10 })).status).toBe(200);
    expect((await estimate()).dispatches_today).toBe(false);
    expect((await outbox())[0]!.tags).toEqual(["shop-settings"]);
    for (const bad of [24, -1, 9.5])
      expect((await patch({ dispatch_cutoff_hour: bad })).status).toBe(422);
  });

  it("B-408: dane firmy - bez NIP/REGON/KRS/BDO, e-maile tylko @taktyl.example, telefony fikcyjne, kod 00-000", async () => {
    const good = {
      name: "Taktyl (podmiot fikcyjny)",
      address: "ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)",
      phone: "+48 22 000 00 00",
      email: "kontakt@taktyl.example",
    };
    const ok = await patch({ company: good });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect((await t.http().get("/v1/shop-settings")).body.company).toEqual(good);
    const bad: [object, string][] = [
      [{ ...good, nip: "1234567890" }, "forbidden_identifier"],
      [{ ...good, KRS: "0000012345" }, "forbidden_identifier"],
      [{ ...good, note: "NIP 123-456-78-90" }, "forbidden_identifier"],
      [{ ...good, note: "REGON 123456789" }, "forbidden_identifier"],
      [{ ...good, email: "kontakt@firma.com" }, "invalid_domain"],
      [{ ...good, www: "https://firma.com/kontakt" }, "invalid_domain"],
      [{ ...good, phone: "+48 601 234 567" }, "real_phone"],
      [{ ...good, address: "ul. Prawdziwa 1, 31-001 Krakow" }, "invalid_postcode"],
      [{ ...good, name: `${BRAND} sp. z o.o.` }, "real_brand"],
    ];
    for (const [company, code] of bad) {
      const r = await patch({ company });
      expect(r.status, JSON.stringify(company)).toBe(422);
      expect(
        r.body.errors.map((e: { code: string }) => e.code),
        JSON.stringify(company),
      ).toContain(code);
    }
    expect((await t.http().get("/v1/shop-settings")).body.company).toEqual(good);
  });

  it("atomowosc: jeden blad w zadaniu = zadna sekcja nie zostaje zapisana, bez audytu i outboxa", async () => {
    const res = await patch({
      free_shipping_threshold_gr: 50000,
      dispatch_cutoff_hour: 9,
      demo: { label: "" },
    });
    expect(res.status).toBe(422);
    const s = await current();
    expect(s).toMatchObject({
      free_shipping_threshold_gr: 29900,
      dispatch_cutoff_hour: 14,
      version: 1,
    });
    expect(await audits()).toHaveLength(0);
    expect(await outbox()).toHaveLength(0);
    expect((await patch({})).status).toBe(422);
    expect((await patch({ nieznane: 1 })).status).toBe(422);
  });

  it("S29: wpis audytu z zakresem zmian jest widoczny dla viewer (bez maskowania ustawien sklepu)", async () => {
    await patch({
      free_shipping_threshold_gr: 31000,
      demo: { label: "Taktyl to sklep demonstracyjny, test." },
    });
    const res = await t
      .http()
      .get("/v1/admin/audit?entity=settings")
      .set("Cookie", sessions.viewer.cookie);
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      action: "settings.update",
      before: { free_shipping_threshold_gr: 29900 },
      after: {
        free_shipping_threshold_gr: 31000,
        demo: { label: "Taktyl to sklep demonstracyjny, test." },
      },
    });
  });
});
