// B-100..B-115 (TAKTYL-47): katalog w backpanelu na PostgreSQL - lista i filtry, szczegoly, PATCH z If-Match (412), tworzenie
// produktu i wariantu, cena (nowy wiersz price_history, lowest_30d z historii), stan z ruchem magazynowym, archiwizacja,
// usuwanie, gotowe sety, role (S28), audit_log (S29), outbox ze znacznikami (S25 po stronie API), stan 0 w wycenie (S27).
import { randomUUID } from "node:crypto";
import { adminProductDetailSchema, adminProductListSchema } from "@taktyl/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { OutboxWorker } from "../src/outbox/outbox.worker.js";
import { addUser, login, type LoggedIn, pw, resetAuth } from "./admin-helpers.js";
import { bootApp, hasDb, NOW, reseed, type TestEnv } from "./helpers.js";
import { startReceiver, type Receiver } from "./receiver.js";

type Role = "owner" | "editor" | "viewer";
type Method = "get" | "post" | "patch" | "put" | "delete";

const SECRET = "r".repeat(40);
const GPSR = {
  manufacturer: "Taktyl (podmiot fikcyjny)",
  address: "ul. Przykladowa 1, 00-000 Miasto (adres fikcyjny)",
  contact: "bezpieczenstwo@taktyl.example",
  warnings: "Nie uzywac w wodzie.",
};
const FIT = { fps: 1, gry: 1, programowanie: 2, biuro: 2, cisza: 2 };
const MOUSE_ATTRS = {
  shape: "symetryczna",
  hand: "obureczna",
  size: "M",
  hand_cm: [17, 20],
  grips: ["palm", "claw"],
  weight_g: 70,
  dims_mm: { w: 62, d: 120, h: 38 },
  connectivity: ["usb-c", "2.4ghz"],
  dpi_max: 26000,
  polling_hz: 1000,
  battery: "300 mAh",
  sensor: "optyczny",
};
const newProduct = (over: Record<string, unknown> = {}) => ({
  id: "m-sikora",
  slug: "sikora",
  category: "myszki",
  name: "Sikora",
  short: "Lekka mysz symetryczna do pracy i gier.",
  attributes: MOUSE_ATTRS,
  options: ["color"],
  badges: [],
  fit: FIT,
  in_box: ["kabel USB-C 1,5 m"],
  gpsr: GPSR,
  ...over,
});

describe.skipIf(!hasDb)("B-100..B-115 katalog w backpanelu (PostgreSQL)", () => {
  let t: TestEnv;
  let receiver: Receiver;
  let now = new Date(NOW);
  const accounts: Record<Role, { email: string; password: string }> = {
    owner: { email: "wlasciciel@taktyl.example", password: pw() },
    editor: { email: "edytor@taktyl.example", password: pw() },
    viewer: { email: "podglad@taktyl.example", password: pw() },
  };
  const sessions = {} as Record<Role, LoggedIn>;

  beforeAll(async () => {
    receiver = await startReceiver(SECRET, () => now.getTime());
    t = await bootApp({
      clock: () => now,
      env: { REVALIDATE_URL: receiver.url, OUTBOX_WORKER_ENABLED: "false" },
    });
    await resetAuth(t.prisma);
    let n = 0;
    for (const [role, a] of Object.entries(accounts) as [Role, (typeof accounts)[Role]][]) {
      await addUser(t.prisma, a.email, role, a.password);
      sessions[role] = await login(t, a.email, a.password, `10.7.0.${++n}`);
    }
  });
  afterAll(async () => {
    await resetAuth(t.prisma);
    await t.close();
    await receiver.close();
  });
  beforeEach(async () => {
    now = new Date(NOW);
    receiver.calls.length = 0;
    receiver.mode = "ok";
    await reseed(t.prisma); // zachowuje konta i sesje
    await t.prisma.$executeRawUnsafe(`TRUNCATE TABLE "outbox", "audit_log" RESTART IDENTITY`);
  });

  const call = (
    role: Role,
    method: Method,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    let r = t.http()[method](path).set("Cookie", sessions[role].cookie);
    if (method !== "get") r = r.set("X-CSRF-Token", sessions[role].csrf);
    for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
    return body === undefined ? r : r.send(body as object);
  };
  const ifMatch = (v: number) => ({ "If-Match": `"${v}"` });
  const detail = async (id: string) => {
    const res = await call("viewer", "get", `/v1/admin/products/${id}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return adminProductDetailSchema.parse(res.body);
  };
  const patch = (id: string, body: object, version: number, role: Role = "editor") =>
    call(role, "patch", `/v1/admin/products/${id}`, body, ifMatch(version));
  const outboxRows = () => t.prisma.outbox.findMany({ orderBy: { id: "asc" } });
  const auditRows = (action: string) =>
    t.prisma.auditLog.findMany({ where: { action }, orderBy: { id: "asc" } });

  // ------------------------------------------------------------------ role (S28) i bramka sesji

  it("S28: viewer czyta, ale kazdy zapis daje 403 forbidden; editor nie usuwa (owner tak); brak sesji = 401", async () => {
    expect((await call("viewer", "get", "/v1/admin/products")).status).toBe(200);
    const writes: [Method, string, unknown?, Record<string, string>?][] = [
      ["post", "/v1/admin/products", newProduct()],
      ["patch", "/v1/admin/products/m-wrobel", { name: "Wrobel X" }, ifMatch(1)],
      ["put", "/v1/admin/variants/M-WRB-GRF/price", { price_gr: 10000 }],
      ["put", "/v1/admin/variants/M-WRB-GRF/stock", { stock: 5, reason: "korekta" }],
      ["put", "/v1/admin/presets/fps", { name: "Nowa nazwa" }, ifMatch(1)],
      ["post", "/v1/admin/products/m-wrobel/variants", {}],
    ];
    for (const [m, p, b, h] of writes) {
      const res = await call("viewer", m, p, b, h);
      expect(res.status, `${m} ${p}`).toBe(403);
      expect(res.body.code).toBe("forbidden");
    }
    expect((await call("editor", "delete", "/v1/admin/products/m-wrobel")).status).toBe(403);
    expect((await call("editor", "delete", "/v1/admin/variants/M-WRB-GRF")).status).toBe(403);
    expect((await t.http().get("/v1/admin/products")).status).toBe(401);
    expect(await outboxRows()).toHaveLength(0);
    expect(await t.prisma.auditLog.count({ where: { action: { startsWith: "product" } } })).toBe(0);
  });

  // ------------------------------------------------------------------ lista i szczegoly

  it("B-100/B-101: lista - 18 produktow, filtry, szukanie z normalizacja l, sortowanie, bledny sort 400", async () => {
    const all = adminProductListSchema.parse(
      (await call("viewer", "get", "/v1/admin/products?per_page=100")).body,
    );
    expect(all.total).toBe(18);
    const wrobel = all.items.find((i) => i.slug === "wrobel");
    expect(wrobel).toMatchObject({
      id: "m-wrobel",
      category: "myszki",
      status: "active",
      variant_count: 2,
      from_price_gr: 12900,
      on_sale: true,
    });
    const q = adminProductListSchema.parse(
      (await call("viewer", "get", "/v1/admin/products?q=lupek")).body,
    );
    expect(q.items.map((i) => i.name)).toEqual(["Łupek 65"]);
    const bySku = adminProductListSchema.parse(
      (await call("viewer", "get", "/v1/admin/products?q=m-wrb-mgl")).body,
    );
    expect(bySku.items.map((i) => i.slug)).toEqual(["wrobel"]);
    const myszki = adminProductListSchema.parse(
      (await call("viewer", "get", "/v1/admin/products?category=myszki")).body,
    );
    expect(myszki.total).toBe(6);
    const promo = adminProductListSchema.parse(
      (await call("viewer", "get", "/v1/admin/products?promo=1")).body,
    );
    expect(promo.items.map((i) => i.slug).sort()).toEqual(["granit-tkl", "wrobel"]);
    const low = adminProductListSchema.parse(
      (await call("viewer", "get", "/v1/admin/products?low_stock=1&per_page=100")).body,
    );
    expect(low.items.map((i) => i.slug)).toEqual(expect.arrayContaining(["bazalt-75", "jerzyk"]));
    const sorted = adminProductListSchema.parse(
      (await call("viewer", "get", "/v1/admin/products?sort=-from_price_gr&per_page=3")).body,
    );
    expect(sorted.items).toHaveLength(3);
    expect(sorted.items[0]!.from_price_gr).toBeGreaterThanOrEqual(sorted.items[1]!.from_price_gr);
    expect((await call("viewer", "get", "/v1/admin/products?sort=haslo")).status).toBe(400);
  });

  it("B-102/B-105: szczegoly - ETag = wersja, regular_price_gr tylko w adminie, lowest_30d_gr z historii; 404", async () => {
    const res = await call("viewer", "get", "/v1/admin/products/m-wrobel");
    expect(res.headers["etag"]).toBe('"1"');
    const d = adminProductDetailSchema.parse(res.body);
    const v = d.variants.find((x) => x.sku === "M-WRB-GRF")!;
    expect(v).toMatchObject({
      price_gr: 12900,
      lowest_30d_gr: 13900,
      regular_price_gr: 14900,
      version: 1,
    });
    expect(d.warnings).toEqual([]);
    const pub = await t.http().get("/v1/products/wrobel");
    expect(JSON.stringify(pub.body)).not.toContain("regular_price");
    expect((await call("viewer", "get", "/v1/admin/products/m-nie-ma")).status).toBe(404);
  });

  // ------------------------------------------------------------------ cena (S25 po stronie API)

  it("S25 (API): zmiana ceny Wrobla = nowy wiersz historii, lowest_30d_gr przeliczone, outbox z tagami, worker -> odbiornik", async () => {
    const before = await t.prisma.priceHistory.findMany({
      where: { sku: "M-WRB-GRF" },
      orderBy: { id: "asc" },
    });
    expect(before).toHaveLength(2);
    const startVersion = (await detail("m-wrobel")).variants.find(
      (v) => v.sku === "M-WRB-GRF",
    )!.version;

    // 1) podwyzka: koniec promocji (lowest_30d_gr znika), historia dopisana, stary wiersz zamkniety
    const up = await call(
      "editor",
      "put",
      "/v1/admin/variants/M-WRB-GRF/price",
      { price_gr: 14500, reason: "cennik jesienny" },
      ifMatch(startVersion),
    );
    expect(up.status, JSON.stringify(up.body)).toBe(200);
    const upDetail = adminProductDetailSchema.parse(up.body);
    const upVariant = upDetail.variants.find((v) => v.sku === "M-WRB-GRF")!;
    expect(upVariant).toMatchObject({ price_gr: 14500, lowest_30d_gr: null });
    expect(upVariant.version).toBe(startVersion + 1);
    const rows = await t.prisma.priceHistory.findMany({
      where: { sku: "M-WRB-GRF" },
      orderBy: { id: "asc" },
    });
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.validTo === null)).toHaveLength(1);
    expect(rows[1]!.validTo).not.toBeNull();
    expect(rows[2]).toMatchObject({ priceGr: 14500, reason: "cennik jesienny" });
    expect(rows[2]!.changedBy).not.toBeNull();
    // wiersze historyczne nietkniete (cena i poczatek obowiazywania)
    expect([rows[0]!.priceGr, rows[1]!.priceGr]).toEqual([13900, 12900]);

    // 2) obnizka: promocja od nowa, najnizsza z 30 dni przed obnizka = 12900 (liczy serwer)
    const down = await call("editor", "put", "/v1/admin/variants/M-WRB-GRF/price", {
      price_gr: 9900,
    });
    const downVariant = adminProductDetailSchema
      .parse(down.body)
      .variants.find((v) => v.sku === "M-WRB-GRF")!;
    expect(downVariant).toMatchObject({ price_gr: 9900, lowest_30d_gr: 12900 });
    const open = await t.prisma.priceHistory.findMany({
      where: { sku: "M-WRB-GRF", validTo: null },
    });
    expect(open.map((r) => r.priceGr)).toEqual([9900]);
    expect(
      (await t.prisma.variant.findUniqueOrThrow({ where: { sku: "M-WRB-GRF" } })).priceGr,
    ).toBe(9900);

    // widok sklepu API liczy z tej samej historii
    const pub = await t.http().get("/v1/products/wrobel");
    const pubVariant = (
      pub.body as { variants: { sku: string; price_gr: number; lowest_30d_gr: number | null }[] }
    ).variants.find((v) => v.sku === "M-WRB-GRF")!;
    expect(pubVariant).toMatchObject({ price_gr: 9900, lowest_30d_gr: 12900 });

    // GET historii: 4 wpisy od najnowszego, wyliczone lowest_30d i okno; osoba widoczna dla editora, zamaskowana dla viewera
    const hist = await call("editor", "get", "/v1/admin/variants/M-WRB-GRF/price-history");
    expect(hist.body.entries.map((e: { price_gr: number }) => e.price_gr)).toEqual([
      9900, 14500, 12900, 13900,
    ]);
    expect(hist.body.lowest_30d_gr).toBe(12900);
    expect(hist.body.window).not.toBeNull();
    expect(hist.body.entries[0].changed_by).toBe(accounts.editor.email);
    const histViewer = await call("viewer", "get", "/v1/admin/variants/M-WRB-GRF/price-history");
    expect(histViewer.body.entries[0].changed_by).toBe("e***@taktyl.example");

    // outbox: znaczniki ceny, audyt przed -> po
    const out = await outboxRows();
    expect(out).toHaveLength(2);
    expect(out[0]!.tags).toEqual(["catalog", "category:myszki", "presets", "product:wrobel"]);
    expect(out.every((o) => o.status === "pending" && o.auditId !== null)).toBe(true);
    const audits = await auditRows("variant.price.set");
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({
      entity: "variant",
      entityId: "M-WRB-GRF",
      actorRole: "editor",
      before: { price_gr: 12900, regular_price_gr: 14900 },
      after: { price_gr: 14500, regular_price_gr: 14900, reason: "cennik jesienny" },
    });

    // worker: odbiornik dostaje jedno podpisane wywolanie ze zdeduplikowanymi znacznikami
    const result = await t.app.get(OutboxWorker).runOnce();
    expect(result).toMatchObject({ picked: 2, sent: 2 });
    expect(receiver.calls).toHaveLength(1);
    expect(receiver.calls[0]).toMatchObject({ signature: "ok" });
    expect(receiver.calls[0]!.tags).toEqual([
      "catalog",
      "category:myszki",
      "presets",
      "product:wrobel",
    ]);
  });

  it("cena: brak recznego lowest_30d (422), ta sama cena nie dopisuje historii ani outboxa, zla cena 422, regular_price tylko wewnetrznie", async () => {
    const put = (body: object) => call("editor", "put", "/v1/admin/variants/M-WRB-GRF/price", body);
    for (const bad of [
      { price_gr: 9900, lowest_30d_gr: 1 },
      { price_gr: 0 },
      { price_gr: -5 },
      { price_gr: 99.5 },
      { price_gr: "99" },
    ]) {
      const r = await put(bad);
      expect(r.status, JSON.stringify(bad)).toBe(422);
    }
    expect(
      (await call("editor", "put", "/v1/admin/variants/M-NIEMA-GRF/price", { price_gr: 1 })).status,
    ).toBe(404);
    expect((await put({ price_gr: 12900 })).status).toBe(200);
    expect(await t.prisma.priceHistory.count({ where: { sku: "M-WRB-GRF" } })).toBe(2);
    expect(await outboxRows()).toHaveLength(0);

    // sama cena wewnetrzna: bez wiersza historii i bez rewalidacji
    const r = await put({ price_gr: 12900, regular_price_gr: 15900 });
    expect(r.status).toBe(200);
    expect(
      adminProductDetailSchema.parse(r.body).variants.find((v) => v.sku === "M-WRB-GRF")!
        .regular_price_gr,
    ).toBe(15900);
    expect(await t.prisma.priceHistory.count({ where: { sku: "M-WRB-GRF" } })).toBe(2);
    expect(await outboxRows()).toHaveLength(0);
    expect(await t.prisma.priceHistory.count({ where: { sku: "M-WRB-GRF", validTo: null } })).toBe(
      1,
    );
  });

  it("cena: konflikt wersji wariantu przy If-Match = 412", async () => {
    const ok = await call(
      "editor",
      "put",
      "/v1/admin/variants/M-WRB-GRF/price",
      { price_gr: 13000 },
      ifMatch(1),
    );
    expect(ok.status).toBe(200);
    const stale = await call(
      "editor",
      "put",
      "/v1/admin/variants/M-WRB-GRF/price",
      { price_gr: 13100 },
      ifMatch(1),
    );
    expect(stale.status).toBe(412);
    expect(stale.body.code).toBe("conflict");
    expect(
      (await t.prisma.variant.findUniqueOrThrow({ where: { sku: "M-WRB-GRF" } })).priceGr,
    ).toBe(13000);
  });

  // ------------------------------------------------------------------ stan (S27 po stronie API)

  it("S27 (API): stan 0 zapisuje ruch adjustment, tagi stanu i wariant jest niedostepny w wycenie", async () => {
    const res = await call("editor", "put", "/v1/admin/variants/M-WRB-MGL/stock", {
      stock: 0,
      reason: "inwentaryzacja",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(
      adminProductDetailSchema.parse(res.body).variants.find((v) => v.sku === "M-WRB-MGL")!.stock,
    ).toBe(0);
    const moves = await call("viewer", "get", "/v1/admin/variants/M-WRB-MGL/stock-movements");
    expect(moves.body.items[0]).toMatchObject({
      delta: -17,
      stock_after: 0,
      kind: "adjustment",
      reason: "inwentaryzacja",
      actor: "e***@taktyl.example",
    });
    // suma ruchow = biezacy stan (docs/17 par. 10)
    const sum = await t.prisma.stockMovement.aggregate({
      where: { sku: "M-WRB-MGL" },
      _sum: { delta: true },
    });
    expect(sum._sum.delta).toBe(0);
    const out = await outboxRows();
    expect(out).toHaveLength(1);
    expect(out[0]!.tags).toEqual(["category:myszki", "facets:myszki", "product:wrobel"]);

    const quote = await t
      .http()
      .post("/v1/cart/quote")
      .send({ items: [{ type: "item", sku: "M-WRB-MGL", qty: 1 }] });
    expect(quote.status).toBe(200);
    expect(quote.body.problems).toEqual([
      { sku: "M-WRB-MGL", code: "out_of_stock", available_qty: 0 },
    ]);
    const pub = await t.http().get("/v1/products/wrobel");
    expect(
      (pub.body as { variants: { sku: string; stock: number }[] }).variants.find(
        (v) => v.sku === "M-WRB-MGL",
      )!.stock,
    ).toBe(0);
  });

  it("stan: ujemny, ulamkowy i bez powodu = 422; ta sama wartosc nie tworzy ruchu; podniesienie stanu = ruch dodatni", async () => {
    const put = (body: object) => call("editor", "put", "/v1/admin/variants/M-WRB-GRF/stock", body);
    for (const bad of [
      { stock: -1, reason: "x" },
      { stock: 1.5, reason: "x" },
      { stock: 3 },
      { stock: 3, reason: "" },
    ]) {
      expect((await put(bad)).status, JSON.stringify(bad)).toBe(422);
    }
    const before = await t.prisma.stockMovement.count({ where: { sku: "M-WRB-GRF" } });
    expect((await put({ stock: 14, reason: "bez zmiany" })).status).toBe(200);
    expect(await t.prisma.stockMovement.count({ where: { sku: "M-WRB-GRF" } })).toBe(before);
    expect(await outboxRows()).toHaveLength(0);
    expect((await put({ stock: 20, reason: "dostawa" })).status).toBe(200);
    const last = await t.prisma.stockMovement.findFirstOrThrow({
      where: { sku: "M-WRB-GRF", kind: "adjustment" },
    });
    expect(last).toMatchObject({ delta: 6, stockAfter: 20, reason: "dostawa" });
  });

  // ------------------------------------------------------------------ PATCH produktu i If-Match

  it("412 przy konflikcie If-Match, 428 bez naglowka, 422 przy zlym formacie; ETag rosnie z wersja", async () => {
    const first = await patch("m-wrobel", { name: "Wrobel 2" }, 1);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.headers["etag"]).toBe('"2"');
    expect(first.body.version).toBe(2);

    const stale = await patch("m-wrobel", { name: "Wrobel 3" }, 1);
    expect(stale.status).toBe(412);
    expect(stale.body.code).toBe("conflict");
    expect((await detail("m-wrobel")).name).toBe("Wrobel 2");

    const missing = await call("editor", "patch", "/v1/admin/products/m-wrobel", { name: "Xx" });
    expect(missing.status).toBe(428);
    const bad = await call(
      "editor",
      "patch",
      "/v1/admin/products/m-wrobel",
      { name: "Xx" },
      { "If-Match": "abc" },
    );
    expect(bad.status).toBe(422);
    expect((await patch("m-nie-ma", { name: "Xx" }, 1)).status).toBe(404);
    // porazka nie zostawia sladu w audycie ani outboxie
    expect(await auditRows("product.update")).toHaveLength(1);
  });

  it("PATCH produktu: audyt przed -> po (tylko zmienione pola), tagi produktu, bez zmiany nie ma wpisu", async () => {
    const res = await patch(
      "m-wrobel",
      {
        name: "Wróbel Pro",
        badges: ["nowosc"],
        attributes: { weight_g: 64 },
        fit: { fps: 3, gry: 3, programowanie: 1, biuro: 1, cisza: 1 },
      },
      1,
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const d = adminProductDetailSchema.parse(res.body);
    expect(d).toMatchObject({ name: "Wróbel Pro", badges: ["nowosc"], version: 2 });
    expect((d.attributes as { weight_g: number }).weight_g).toBe(64);
    const [a] = await auditRows("product.update");
    expect(a).toMatchObject({ entity: "product", entityId: "m-wrobel", actorRole: "editor" });
    expect(Object.keys(a!.after as object).sort()).toEqual(["attributes", "badges", "fit", "name"]);
    expect((a!.before as { name: string }).name).toBe("Wróbel");
    const out = await outboxRows();
    expect(out).toHaveLength(1);
    expect(out[0]!.tags).toEqual([
      "catalog",
      "category:myszki",
      "facets:myszki",
      "presets",
      "product:wrobel",
      "reviews:wrobel",
    ]);
    // identyczne wartosci: brak zmiany wersji, audytu i outboxa
    const same = await patch("m-wrobel", { name: "Wróbel Pro" }, 2);
    expect(same.status).toBe(200);
    expect(same.body.version).toBe(2);
    expect(await auditRows("product.update")).toHaveLength(1);
    expect(await outboxRows()).toHaveLength(1);
    // sklep widzi zmiane od razu (odczyt z bazy, bez cache po stronie API)
    expect((await t.http().get("/v1/products/wrobel")).body.name).toBe("Wróbel Pro");
  });

  it("walidacja: atrybuty wg kategorii (zly typ, nieznany klucz), kontakt GPSR poza domena, plakietki, slug zajety = 422/409", async () => {
    const bad = await patch("m-wrobel", { attributes: { weight_g: -5 } }, 1);
    expect(bad.status).toBe(422);
    expect(bad.body.errors[0].path).toBe("attributes.weight_g");
    const unknown = await patch("m-wrobel", { attributes: { moc_silnika: 3 } }, 1);
    expect(unknown.status).toBe(422);
    expect(unknown.body.errors[0]).toMatchObject({
      path: "attributes.moc_silnika",
      code: "unrecognized_key",
    });
    const mixed = await patch("m-wrobel", { attributes: { hotswap: true } }, 1);
    expect(mixed.status).toBe(422);
    const gpsr = await patch("m-wrobel", { gpsr: { ...GPSR, contact: "kontakt@example.com" } }, 1);
    expect(gpsr.status).toBe(422);
    expect(gpsr.body.errors[0].path).toBe("gpsr.contact");
    expect((await patch("m-wrobel", { badges: ["promocja"] }, 1)).status).toBe(422);
    expect((await patch("m-wrobel", { fit: { ...FIT, fps: 4 } }, 1)).status).toBe(422);
    expect((await patch("m-wrobel", { unknown_field: 1 }, 1)).status).toBe(422);
    const taken = await patch("m-wrobel", { slug: "jerzyk" }, 1);
    expect(taken.status).toBe(409);
    expect(taken.body.errors[0]).toMatchObject({ path: "slug", code: "slug_taken" });
    expect(await outboxRows()).toHaveLength(0);
    expect(await auditRows("product.update")).toHaveLength(0);
  });

  it("zmiana slugu odswieza stary i nowy adres (product:{stary}, product:{nowy})", async () => {
    const res = await patch("m-wrobel", { slug: "wrobel-2" }, 1);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const out = await outboxRows();
    expect(out[0]!.tags).toEqual(
      expect.arrayContaining([
        "product:wrobel",
        "product:wrobel-2",
        "reviews:wrobel",
        "reviews:wrobel-2",
      ]),
    );
    expect((await t.http().get("/v1/products/wrobel")).status).toBe(404);
    expect((await t.http().get("/v1/products/wrobel-2")).status).toBe(200);
  });

  // ------------------------------------------------------------------ archiwizacja

  it("B-110: archiwizacja ukrywa produkt (404 karty, listing, szukanie, sety) i ostrzega o setach; przywrocenie dziala", async () => {
    const before = await detail("k-bazalt-75");
    const res = await patch("k-bazalt-75", { status: "archived" }, before.version);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const d = adminProductDetailSchema.parse(res.body);
    expect(d.status).toBe("archived");
    expect(d.warnings).toEqual([
      expect.objectContaining({ code: "in_presets", details: ["programista"] }),
    ]);

    expect((await t.http().get("/v1/products/bazalt-75")).status).toBe(404);
    const listing = await t.http().get("/v1/products?category=klawiatury&limit=48");
    expect((listing.body as { items: { slug: string }[] }).items.map((i) => i.slug)).not.toContain(
      "bazalt-75",
    );
    const presets = await t.http().get("/v1/presets");
    expect((presets.body as { items: { id: string }[] }).items.map((i) => i.id)).not.toContain(
      "programista",
    );
    const adminList = adminProductListSchema.parse(
      (await call("viewer", "get", "/v1/admin/products?status=archived")).body,
    );
    expect(adminList.items.map((i) => i.slug)).toEqual(["bazalt-75"]);

    const back = await patch("k-bazalt-75", { status: "active" }, d.version);
    expect(back.status).toBe(200);
    expect((await t.http().get("/v1/products/bazalt-75")).status).toBe(200);
    const presets2 = await t.http().get("/v1/presets");
    expect((presets2.body as { items: { id: string }[] }).items.map((i) => i.id)).toContain(
      "programista",
    );
    expect((await auditRows("product.update")).map((a) => a.after)).toEqual([
      { status: "archived" },
      { status: "active" },
    ]);
  });

  // ------------------------------------------------------------------ tworzenie produktu i wariantu

  it("B-111: nowy produkt jest ukryty do pierwszego wariantu; SKU wg wzoru; aktywacja wymaga aktywnego wariantu", async () => {
    const created = await call("editor", "post", "/v1/admin/products", newProduct());
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const d = adminProductDetailSchema.parse(created.body);
    expect(d).toMatchObject({
      status: "archived",
      variants: [],
      default_variant_sku: null,
      version: 1,
    });
    expect((await t.http().get("/v1/products/sikora")).status).toBe(404);
    let out = await outboxRows();
    expect(out[0]!.tags).toEqual(["catalog", "category:myszki", "facets:myszki"]);

    // aktywacja bez wariantu jest zablokowana
    const early = await patch("m-sikora", { status: "active" }, 1);
    expect(early.status).toBe(422);
    expect(early.body.errors[0]).toMatchObject({ path: "status", code: "no_active_variant" });

    const variant = {
      sku: "M-SKR-KOB",
      color: "kobalt",
      price_gr: 18900,
      stock: 7,
      images_key: "kobalt",
    };
    for (const bad of [
      { ...variant, sku: "M-SKR-GRF" }, // kod koloru w SKU niezgodny z kolorem
      { ...variant, sku: "K-SKR-KOB-SLZ" }, // prefiks innej kategorii
      { ...variant, switch: "slizg" }, // przelacznik nie dotyczy myszek
      { ...variant, size: "m" },
      { ...variant, images_key: "grafit" },
      { ...variant, price_gr: 0 },
      { ...variant, stock: -1 },
      { ...variant, color: "zielony" },
    ]) {
      const r = await call("editor", "post", "/v1/admin/products/m-sikora/variants", bad);
      expect(r.status, JSON.stringify(bad)).toBe(422);
    }
    const ok = await call("editor", "post", "/v1/admin/products/m-sikora/variants", variant);
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    const withVariant = adminProductDetailSchema.parse(ok.body);
    expect(withVariant.default_variant_sku).toBe("M-SKR-KOB");
    expect(withVariant.variants).toHaveLength(1);
    expect(withVariant.variants[0]).toMatchObject({
      price_gr: 18900,
      stock: 7,
      lowest_30d_gr: null,
    });
    expect(await t.prisma.priceHistory.count({ where: { sku: "M-SKR-KOB", validTo: null } })).toBe(
      1,
    );
    const mv = await t.prisma.stockMovement.findFirstOrThrow({ where: { sku: "M-SKR-KOB" } });
    expect(mv).toMatchObject({ delta: 7, stockAfter: 7, kind: "adjustment" });

    // duplikaty
    const dupSku = await call("editor", "post", "/v1/admin/products/m-sikora/variants", variant);
    expect(dupSku.status).toBe(409);
    const dupCombo = await call("editor", "post", "/v1/admin/products/m-sikora/variants", {
      ...variant,
      sku: "M-SKX-KOB",
    });
    expect(dupCombo.status).toBe(409);
    expect(dupCombo.body.errors[0].code).toBe("variant_exists");
    expect((await call("editor", "post", "/v1/admin/products", newProduct())).status).toBe(409);
    const slugClash = await call(
      "editor",
      "post",
      "/v1/admin/products",
      newProduct({ id: "m-sikora-2", slug: "sikora" }),
    );
    expect(slugClash.status).toBe(409);
    expect(slugClash.body.errors[0]).toMatchObject({ path: "slug", code: "slug_taken" });

    const act = await patch("m-sikora", { status: "active" }, 1);
    expect(act.status, JSON.stringify(act.body)).toBe(200);
    const pub = await t.http().get("/v1/products/sikora");
    expect(pub.status).toBe(200);
    expect(pub.body.default_variant_sku).toBe("M-SKR-KOB");
    out = await outboxRows();
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(await auditRows("variant.create")).toHaveLength(1);
    expect(await auditRows("product.create")).toHaveLength(1);
  });

  it("B-111: komplet atrybutow dla kategorii, opcje zgodne z kategoria, prefiks identyfikatora, kontakt GPSR", async () => {
    const post = (body: object) => call("editor", "post", "/v1/admin/products", body);
    const { dpi_max: _dpi, ...incomplete } = MOUSE_ATTRS;
    const cases: [object, string][] = [
      [newProduct({ attributes: incomplete }), "attributes.dpi_max"],
      [newProduct({ options: ["color", "switch"] }), "options"],
      [newProduct({ id: "k-sikora" }), "id"],
      [newProduct({ gpsr: { ...GPSR, contact: "x@example.com" } }), "gpsr.contact"],
      [newProduct({ attributes: { ...MOUSE_ATTRS, extra: 1 } }), "attributes.extra"],
    ];
    for (const [body, path] of cases) {
      const r = await post(body);
      expect(r.status, path).toBe(422);
      expect(r.body.errors.map((e: { path: string }) => e.path)).toContain(path);
    }
    expect(await t.prisma.product.count({ where: { id: { startsWith: "m-sik" } } })).toBe(0);
    expect(await outboxRows()).toHaveLength(0);
  });

  it("B-103: PATCH wariantu - dostepnosc, If-Match wariantu, ostatni aktywny wariant chroniony, ostrzezenie o domyslnym bez stanu", async () => {
    const d = await detail("m-wrobel");
    const grf = d.variants.find((v) => v.sku === "M-WRB-GRF")!;
    const off = await call(
      "editor",
      "patch",
      "/v1/admin/variants/M-WRB-GRF",
      { status: "disabled" },
      ifMatch(grf.version),
    );
    expect(off.status, JSON.stringify(off.body)).toBe(200);
    const offDetail = adminProductDetailSchema.parse(off.body);
    expect(offDetail.variants.find((v) => v.sku === "M-WRB-GRF")!.status).toBe("disabled");
    expect(offDetail.variants.find((v) => v.sku === "M-WRB-GRF")!.version).toBe(grf.version + 1);
    // stary If-Match = 412
    const stale = await call(
      "editor",
      "patch",
      "/v1/admin/variants/M-WRB-GRF",
      { status: "active" },
      ifMatch(grf.version),
    );
    expect(stale.status).toBe(412);
    // wylaczenie ostatniego aktywnego wariantu aktywnego produktu: 422
    const mgl = offDetail.variants.find((v) => v.sku === "M-WRB-MGL")!;
    const last = await call(
      "editor",
      "patch",
      "/v1/admin/variants/M-WRB-MGL",
      { status: "disabled" },
      ifMatch(mgl.version),
    );
    expect(last.status).toBe(422);
    expect(last.body.errors[0].code).toBe("last_active_variant");
    expect(
      (await call("editor", "patch", "/v1/admin/variants/M-WRB-MGL", {}, ifMatch(mgl.version)))
        .status,
    ).toBe(422);
    const pub = await t.http().get("/v1/products/wrobel");
    expect(
      (pub.body as { variants: { sku: string; status: string }[] }).variants.find(
        (v) => v.sku === "M-WRB-GRF",
      )!.status,
    ).toBe("disabled");
    // ostrzezenie: domyslny wariant bez stanu przy dostepnym innym
    const zero = await call("editor", "put", "/v1/admin/variants/M-WRB-MGL/stock", {
      stock: 3,
      reason: "x",
    });
    expect(zero.status).toBe(200);
    const re = await call(
      "editor",
      "patch",
      "/v1/admin/variants/M-WRB-GRF",
      { status: "active" },
      ifMatch(offDetail.variants.find((v) => v.sku === "M-WRB-GRF")!.version),
    );
    expect(re.status).toBe(200);
    const stock0 = await call("editor", "put", "/v1/admin/variants/M-WRB-GRF/stock", {
      stock: 0,
      reason: "brak",
    });
    expect(adminProductDetailSchema.parse(stock0.body).warnings.map((w) => w.code)).toContain(
      "default_variant_out_of_stock",
    );
  });

  // ------------------------------------------------------------------ usuwanie

  it("B-110: twarde usuniecie tylko bez zamowien i setow; bez nich czysci historie cen i ruchy; archiwizacja zamiast usuwania", async () => {
    // produkt w gotowym secie: 409
    const inPreset = await call("owner", "delete", "/v1/admin/products/k-bazalt-75");
    expect(inPreset.status).toBe(409);
    expect(inPreset.body.errors[0].code).toBe("in_presets");

    // produkt z zamowieniem: 409 (utworzony recznie, bez setu)
    const wrobel = await t.prisma.variant.findUniqueOrThrow({ where: { sku: "M-WRB-GRF" } });
    await t.prisma.order.create({
      data: {
        number: "TK-261007-ABCD",
        status: "paid",
        orderTokenHash: "h",
        idempotencyKey: randomUUID(),
        shippingMethodId: "kurier",
        paymentType: "blik",
        itemsGr: wrobel.priceGr,
        setDiscountGr: 0,
        couponDiscountGr: 0,
        shippingGr: 0,
        totalGr: wrobel.priceGr,
        consents: { terms: true, newsletter: false },
        items: {
          create: [
            {
              sku: "M-WRB-GRF",
              name: "Wróbel",
              variantLabel: "grafit",
              qty: 1,
              unitPriceGr: wrobel.priceGr,
            },
          ],
        },
      },
    });
    const withOrders = await call("owner", "delete", "/v1/admin/products/m-wrobel");
    expect(withOrders.status).toBe(409);
    expect(withOrders.body.errors[0].code).toBe("has_orders");
    expect((await call("owner", "delete", "/v1/admin/variants/M-WRB-GRF")).status).toBe(409);
    expect(await t.prisma.product.count({ where: { id: "m-wrobel" } })).toBe(1);

    // nowy produkt z wariantem, bez zamowien: usuwa sie razem z historia cen i ruchami
    await call("editor", "post", "/v1/admin/products", newProduct());
    await call("editor", "post", "/v1/admin/products/m-sikora/variants", {
      sku: "M-SKR-KOB",
      color: "kobalt",
      price_gr: 18900,
      stock: 7,
      images_key: "kobalt",
    });
    await t.prisma.$executeRawUnsafe(`TRUNCATE TABLE "outbox" RESTART IDENTITY`);
    const del = await call("owner", "delete", "/v1/admin/products/m-sikora");
    expect(del.status, JSON.stringify(del.body)).toBe(204);
    expect(await t.prisma.product.count({ where: { id: "m-sikora" } })).toBe(0);
    expect(await t.prisma.variant.count({ where: { sku: "M-SKR-KOB" } })).toBe(0);
    expect(await t.prisma.priceHistory.count({ where: { sku: "M-SKR-KOB" } })).toBe(0);
    expect(await t.prisma.stockMovement.count({ where: { sku: "M-SKR-KOB" } })).toBe(0);
    const [a] = await auditRows("product.delete");
    expect(a).toMatchObject({ entityId: "m-sikora", actorRole: "owner" });
    expect((await outboxRows())[0]!.tags).toEqual(expect.arrayContaining(["product:sikora"]));
    // historia cen nadal chroniona poza kontrolowanym usuwaniem
    await expect(t.prisma.$executeRawUnsafe(`DELETE FROM "price_history"`)).rejects.toThrow();
    expect((await call("owner", "delete", "/v1/admin/products/m-sikora")).status).toBe(404);
  });

  it("B-110: usuniecie wariantu - ostatni aktywny wariant aktywnego produktu chroniony, domyslny wariant przechodzi na inny", async () => {
    await call("editor", "post", "/v1/admin/products", newProduct());
    const v1 = {
      sku: "M-SKR-KOB",
      color: "kobalt",
      price_gr: 18900,
      stock: 7,
      images_key: "kobalt",
    };
    const v2 = {
      sku: "M-SKR-GRF",
      color: "grafit",
      price_gr: 18900,
      stock: 2,
      images_key: "grafit",
    };
    await call("editor", "post", "/v1/admin/products/m-sikora/variants", v1);
    await call("editor", "post", "/v1/admin/products/m-sikora/variants", v2);
    await patch("m-sikora", { status: "active" }, 1);
    const del1 = await call("owner", "delete", "/v1/admin/variants/M-SKR-KOB");
    expect(del1.status).toBe(204);
    expect((await detail("m-sikora")).default_variant_sku).toBe("M-SKR-GRF");
    const last = await call("owner", "delete", "/v1/admin/variants/M-SKR-GRF");
    expect(last.status).toBe(422);
    expect(last.body.errors[0].code).toBe("last_active_variant");
  });

  // ------------------------------------------------------------------ gotowe sety

  it("B-114: sety - lista z cena liczona i wersja, edycja pod If-Match, walidacja skladu, tag presets", async () => {
    const list = await call("viewer", "get", "/v1/admin/presets");
    expect(list.status).toBe(200);
    const fps = list.body.items.find((i: { id: string }) => i.id === "fps");
    expect(fps).toMatchObject({ version: 1, total_gr: 79830 });

    const ok = await call(
      "editor",
      "put",
      "/v1/admin/presets/fps",
      { name: "Zestaw FPS Plus" },
      ifMatch(1),
    );
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body).toMatchObject({ name: "Zestaw FPS Plus", version: 2 });
    expect(ok.headers["etag"]).toBe('"2"');
    expect(
      (await t.http().get("/v1/presets")).body.items.find((i: { id: string }) => i.id === "fps")
        .name,
    ).toBe("Zestaw FPS Plus");
    expect((await outboxRows())[0]!.tags).toEqual(["presets"]);
    expect((await auditRows("preset.update"))[0]).toMatchObject({ entityId: "fps" });

    expect(
      (await call("editor", "put", "/v1/admin/presets/fps", { name: "Inna" }, ifMatch(1))).status,
    ).toBe(412);
    expect((await call("editor", "put", "/v1/admin/presets/fps", { name: "Inna" })).status).toBe(
      428,
    );
    // dwie klawiatury zamiast jednej z kategorii
    const bad = await call(
      "editor",
      "put",
      "/v1/admin/presets/fps",
      { skus: ["K-KWR60-GRF-SLZ", "K-BZL75-GRF-PRG", "P-LEN-XL-GRF"] },
      ifMatch(2),
    );
    expect(bad.status).toBe(422);
    expect(bad.body.errors[0].code).toBe("invalid_categories");
    // zmiana skladu przelicza cene
    const swap = await call(
      "editor",
      "put",
      "/v1/admin/presets/fps",
      { skus: ["K-BZL75-GRF-PRG", "M-JRZ-GRF", "P-LEN-XL-GRF"] },
      ifMatch(2),
    );
    expect(swap.status, JSON.stringify(swap.body)).toBe(200);
    expect(swap.body.items.map((i: { sku: string }) => i.sku)).toContain("K-BZL75-GRF-PRG");
    expect(
      (await call("editor", "put", "/v1/admin/presets/nie-ma", { name: "Xx" }, ifMatch(1))).status,
    ).toBe(404);
  });

  // ------------------------------------------------------------------ audit_log (S29)

  it("S29: audit_log - kto, co, przed -> po dla kazdej mutacji; wpis powstaje razem ze zmiana; tabela tylko do dopisywania", async () => {
    await call("editor", "put", "/v1/admin/variants/M-WRB-GRF/price", { price_gr: 11900 });
    await call("editor", "put", "/v1/admin/variants/M-WRB-GRF/stock", { stock: 9, reason: "spis" });
    await patch("m-wrobel", { name: "Wróbel Mk2" }, 1);
    const res = await call("viewer", "get", "/v1/admin/audit?entity_id=M-WRB-GRF");
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { action: string }) => i.action).sort()).toEqual([
      "variant.price.set",
      "variant.stock.set",
    ]);
    const price = res.body.items.find((i: { action: string }) => i.action === "variant.price.set");
    expect(price).toMatchObject({
      actor_role: "editor",
      before: { price_gr: 12900 },
      after: { price_gr: 11900 },
    });
    expect(price.actor_id).toBe(
      (await t.prisma.adminUser.findUniqueOrThrow({ where: { email: accounts.editor.email } })).id,
    );
    expect(price.request_id).toBeTruthy();
    const product = await call("owner", "get", "/v1/admin/audit?entity=product&entity_id=m-wrobel");
    expect(product.body.items[0]).toMatchObject({
      action: "product.update",
      before: { name: "Wróbel" },
      after: { name: "Wróbel Mk2" },
    });
    await expect(
      t.prisma.$executeRawUnsafe(`UPDATE "audit_log" SET action = 'x'`),
    ).rejects.toThrow();
    // kazdy wpis audytu mutacji ma wiersz outbox powiazany po audit_id
    const withOutbox = await t.prisma.outbox.count({ where: { auditId: { not: null } } });
    expect(withOutbox).toBe(3);
  });

  it("atomowosc: blad walidacji lub konflikt nie zostawia wpisu audytu ani outboxa", async () => {
    await patch("m-wrobel", { attributes: { weight_g: -1 } }, 1);
    await patch("m-wrobel", { name: "Zly" }, 99);
    await call("editor", "put", "/v1/admin/variants/M-WRB-GRF/price", { price_gr: -1 });
    expect(await t.prisma.auditLog.count()).toBe(0);
    expect(await outboxRows()).toHaveLength(0);
    expect((await detail("m-wrobel")).name).toBe("Wróbel");
  });
});
