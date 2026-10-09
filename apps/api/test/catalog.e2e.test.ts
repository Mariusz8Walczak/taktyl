// F-020...F-026, F-029, F-064, F-005 (B-216): integracyjne testy katalogu - scenariusze S1-S6, S22 z docs/12.
import {
  categoriesResponseSchema,
  completeSetResponseSchema,
  facetsResponseSchema,
  listingResponseSchema,
  problemSchema,
  productSchema,
  searchResponseSchema,
} from "@taktyl/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootApp, hasDb, type TestEnv } from "./helpers.js";

describe.skipIf(!hasDb)("B-216 katalog (PostgreSQL)", () => {
  let t: TestEnv;
  beforeAll(async () => {
    t = await bootApp();
  });
  afterAll(async () => {
    await t.close();
  });

  const names = (body: { items: { name: string }[] }): string[] => body.items.map((i) => i.name);

  // TAKTYL-78 (F-021): rozmiar myszek S/M/L (wielkie litery w data/facets.json) nie jest odrzucany przez kontrakt.
  describe("TAKTYL-78 filtr rozmiaru myszek", () => {
    const raw = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../data/products.json", import.meta.url)), "utf8"),
    ) as { products?: unknown } | unknown[];
    const all = (Array.isArray(raw) ? raw : (raw.products as unknown[])) as {
      category: string;
      name: string;
      attributes: { size?: string };
    }[];
    const mice = all.filter((p) => p.category === "myszki");
    const expected = (sizes: string[]): string[] =>
      mice
        .filter((p) => sizes.includes(p.attributes.size ?? ""))
        .map((p) => p.name)
        .sort();

    it.each([["S"], ["M"], ["L"], ["S", "L"]])(
      "rozmiar=%s zwraca produkty o tym rozmiarze",
      async (...sizes) => {
        const res = await t
          .http()
          .get(`/v1/products?category=myszki&rozmiar=${sizes.join(",")}`)
          .expect(200);
        const body = listingResponseSchema.parse(res.body);
        expect(expected(sizes).length).toBeGreaterThan(0);
        expect(names(body).sort()).toEqual(expected(sizes));
        expect(body.total).toBe(expected(sizes).length);
      },
    );

    it("facety myszek z rozmiarem=M maja poprawne liczniki, a smiec daje 400", async () => {
      const res = await t.http().get("/v1/facets?category=myszki&rozmiar=M").expect(200);
      facetsResponseSchema.parse(res.body);
      await t.http().get("/v1/products?category=myszki&rozmiar=M;DROP").expect(400);
    });
  });

  it("S1: klawiatury 75% + Bluetooth = 1 produkt (Bazalt 75)", async () => {
    const res = await t
      .http()
      .get("/v1/products?category=klawiatury&rozmiar=75&lacznosc=bt")
      .expect(200);
    const body = listingResponseSchema.parse(res.body);
    expect(body.total).toBe(1);
    expect(names(body)).toEqual(["Bazalt 75"]);
    expect(body.next_cursor).toBeNull();
  });

  it("S2: klawiatury 300-700 zl (cena w groszach) = 4 produkty", async () => {
    const res = await t.http().get("/v1/products?category=klawiatury&cena=30000-70000").expect(200);
    const body = listingResponseSchema.parse(res.body);
    expect(body.total).toBe(4);
    expect(names(body).sort()).toEqual(["Granit TKL", "Kreda 98", "Marmur 100", "Łupek 65"].sort());
  });

  it("S3: myszki, dlugosc dloni 19,5 = 5 produktow, bez Mewy", async () => {
    const res = await t.http().get("/v1/products?category=myszki&dlon=19.5").expect(200);
    const body = listingResponseSchema.parse(res.body);
    expect(body.total).toBe(5);
    expect(names(body)).not.toContain("Mewa");
  });

  it("S4: podkladki na biurko = 5 produktow, bez Lodu", async () => {
    const res = await t.http().get("/v1/products?category=podkladki&typ=biurko").expect(200);
    const body = listingResponseSchema.parse(res.body);
    expect(body.total).toBe(5);
    expect(names(body)).not.toContain("Lód");
  });

  it("kursor Pokaz wiecej: limit=4 daje kolejne strony bez powtorzen i konczy sie null", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url: string = `/v1/products?category=klawiatury&limit=4${cursor ? `&cursor=${cursor}` : ""}`;
      const body = listingResponseSchema.parse((await t.http().get(url).expect(200)).body);
      seen.push(...body.items.map((i) => i.id));
      cursor = body.next_cursor;
      pages += 1;
    } while (cursor !== null && pages < 5);
    expect(pages).toBe(2);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(6);
  });

  it("sortowanie cena-rosnaco i cena-malejaco", async () => {
    const asc = listingResponseSchema.parse(
      (await t.http().get("/v1/products?category=myszki&sort=cena-rosnaco").expect(200)).body,
    );
    const prices = asc.items.map((i) => i.from_price_gr);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const desc = listingResponseSchema.parse(
      (await t.http().get("/v1/products?category=myszki&sort=cena-malejaco").expect(200)).body,
    );
    expect(desc.items.map((i) => i.from_price_gr)).toEqual([...prices].sort((a, b) => b - a));
  });

  it("facety z licznikami liczonymi z aktywnymi filtrami; zero = disabled", async () => {
    const res = await t
      .http()
      .get("/v1/facets?category=klawiatury&rozmiar=75&lacznosc=bt")
      .expect(200);
    const body = facetsResponseSchema.parse(res.body);
    expect(body.total).toBe(1);
    const rozmiar = body.facets.find((f) => f.id === "rozmiar");
    expect(rozmiar?.type).toBe("multi");
    if (rozmiar?.type === "multi") {
      expect(rozmiar.values.find((v) => v.v === "75")?.count).toBe(1);
      // inne rozmiary nie maja Bluetooth: licznik 0 i disabled
      const other = rozmiar.values.filter((v) => v.v !== "75");
      expect(other.some((v) => v.count === 0 && v.disabled)).toBe(true);
    }
  });

  it("zla kategoria i zly kursor: problem+json z X-Request-Id", async () => {
    const bad = await t.http().get("/v1/products?category=drony").expect(400);
    expect(bad.headers["content-type"]).toContain("application/problem+json");
    const p = problemSchema.parse(bad.body);
    expect(p.code).toBe("validation_failed");
    expect(p.instance).toBe(bad.headers["x-request-id"]);
    await t.http().get("/v1/products?category=klawiatury&cursor=zly!").expect(400);
  });

  it("S5: Granit TKL 599,00 zl, lowest_30d 699,00 zl (liczone z price_history)", async () => {
    const res = await t.http().get("/v1/products/granit-tkl").expect(200);
    const p = productSchema.parse(res.body);
    const v = p.variants.find((x) => x.lowest_30d_gr !== null);
    expect(v?.price_gr).toBe(59900);
    expect(v?.lowest_30d_gr).toBe(69900);
    expect(JSON.stringify(res.body)).not.toContain("regular_price");
  });

  it("S6: Wrobel 129,00 zl, lowest_30d 139,00 zl (nie 149,00)", async () => {
    const p = productSchema.parse((await t.http().get("/v1/products/wrobel").expect(200)).body);
    const promo = p.variants.filter((x) => x.lowest_30d_gr !== null);
    expect(promo.length).toBeGreaterThan(0);
    for (const v of promo) {
      expect(v.price_gr).toBe(12900);
      expect(v.lowest_30d_gr).toBe(13900);
    }
  });

  it("karta w listingu niesie lowest_30d_gr tylko dla promocji", async () => {
    const body = listingResponseSchema.parse(
      (await t.http().get("/v1/products?category=klawiatury").expect(200)).body,
    );
    expect(body.items.filter((i) => i.lowest_30d_gr !== null).map((i) => i.name)).toEqual([
      "Granit TKL",
    ]);
  });

  it("produkt: ?sku= wybiera wariant, nieznany SKU i slug to 404", async () => {
    const p = productSchema.parse(
      (await t.http().get("/v1/products/bazalt-75?sku=K-BZL75-KOB-SZP").expect(200)).body,
    );
    expect(p.default_variant_sku).toBe("K-BZL75-KOB-SZP");
    expect(p.variants.find((v) => v.sku === "K-BZL75-KOB-SZP")?.stock).toBe(0);
    await t.http().get("/v1/products/nie-ma").expect(404);
    await t.http().get("/v1/products/bazalt-75?sku=K-ZZZ-GRF-PRG").expect(404);
  });

  it("kategorie: 3 pozycje z liczba modeli i cena od", async () => {
    const body = categoriesResponseSchema.parse(
      (await t.http().get("/v1/categories").expect(200)).body,
    );
    expect(body.items.map((c) => c.id)).toEqual(["klawiatury", "myszki", "podkladki"]);
    expect(body.items.reduce((a, c) => a + c.model_count, 0)).toBe(18);
    expect(body.items.every((c) => (c.from_price_gr ?? 0) > 0)).toBe(true);
  });

  it("odpowiedzi publiczne maja ETag i Cache-Control must-revalidate, 304 przy If-None-Match", async () => {
    const first = await t.http().get("/v1/switches").expect(200);
    expect(first.headers["cache-control"]).toBe("public, max-age=0, must-revalidate");
    const etag = first.headers["etag"];
    expect(etag).toBeTruthy();
    await t
      .http()
      .get("/v1/switches")
      .set("If-None-Match", etag as string)
      .expect(304);
  });

  it("S22: wyszukiwanie z normalizacja l: lupek, lod, pustulka, tkl", async () => {
    const find = async (q: string): Promise<string[]> => {
      const body = searchResponseSchema.parse(
        (
          await t
            .http()
            .get(`/v1/search?q=${encodeURIComponent(q)}`)
            .expect(200)
        ).body,
      );
      return body.products.map((p) => p.name);
    };
    expect(await find("lupek")).toContain("Łupek 65");
    expect(await find("lod")).toContain("Lód");
    expect(await find("pustulka")).toContain("Pustułka");
    expect(await find("tkl")).toContain("Granit TKL");
    expect(await find("ŁUPEK")).toContain("Łupek 65");
    expect(await find("zzzzzz")).toEqual([]);
  });

  it("synonimy F-006: cicha zwraca produkty z fit.cisza >= 2", async () => {
    const body = searchResponseSchema.parse(
      (await t.http().get("/v1/search?q=cicha&limit=20").expect(200)).body,
    );
    expect(body.products.length).toBeGreaterThan(0);
  });

  it("complete-set: dwie pozostale kategorie, cena setu z rabatem 10% z domeny", async () => {
    const body = completeSetResponseSchema.parse(
      (await t.http().get("/v1/products/bazalt-75/complete-set").expect(200)).body,
    );
    expect(body.items).toHaveLength(3);
    expect(body.items[0]?.sku.startsWith("K-")).toBe(true);
    expect(body.items[1]?.sku.startsWith("M-")).toBe(true);
    expect(body.items[2]?.sku.startsWith("P-")).toBe(true);
    expect(body.sum_gr).toBe(body.items.reduce((a, i) => a + i.price_gr, 0));
    expect(body.set_discount_gr).toBe(Math.round(body.sum_gr / 10));
    expect(body.total_gr).toBe(body.sum_gr - body.set_discount_gr);
  });

  it("presety: 4 sety z cenami zgodnymi co do grosza (docs/17 par. 7)", async () => {
    const body = (await t.http().get("/v1/presets").expect(200)).body as {
      items: { id: string; total_gr: number; sum_gr: number; set_discount_gr: number }[];
    };
    const totals = Object.fromEntries(body.items.map((p) => [p.id, p.total_gr]));
    expect(totals).toEqual({ programista: 120330, fps: 79830, "open-space": 90630, kobalt: 77130 });
    for (const p of body.items) expect(p.sum_gr - p.set_discount_gr).toBe(p.total_gr);
  });

  it("slowniki i ustawienia: switches, colors, rules, shop-settings, pickup-points, shipping-estimate", async () => {
    expect(
      ((await t.http().get("/v1/switches").expect(200)).body as { items: unknown[] }).items,
    ).toHaveLength(4);
    expect(
      ((await t.http().get("/v1/colors").expect(200)).body as { items: unknown[] }).items,
    ).toHaveLength(49);
    await t.http().get("/v1/rules").expect(200);
    const shop = (await t.http().get("/v1/shop-settings").expect(200)).body as {
      free_shipping_threshold_gr: number;
      discount_codes: Record<string, unknown>[];
    };
    expect(shop.free_shipping_threshold_gr).toBe(29900);
    expect(shop.discount_codes.every((c) => Object.keys(c).sort().join() === "code,label")).toBe(
      true,
    );
    const waw = (await t.http().get("/v1/pickup-points?city=Warszawa").expect(200)).body as {
      items: unknown[];
    };
    expect(waw.items).toHaveLength(2);
    const krk = (await t.http().get("/v1/pickup-points?city=krakow").expect(200)).body as {
      items: unknown[];
    };
    expect(krk.items).toHaveLength(1);
    const est = (await t.http().get("/v1/shipping-estimate?method=kurier").expect(200))
      .body as Record<string, unknown>;
    expect(est).toMatchObject({
      dispatch_date: "2026-10-07",
      delivery_date: "2026-10-08",
      dispatches_today: true,
    });
    await t.http().get("/v1/shipping-estimate?method=dron").expect(400);
  });
});
