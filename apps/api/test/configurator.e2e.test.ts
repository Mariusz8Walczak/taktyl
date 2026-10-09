// F-250..F-254 (ADR-0011): slowniki i wycena konfiguracji wlasnej (PostgreSQL). Cena tylko z serwera.
import {
  configuratorDataSchema,
  configuratorQuoteSchema,
  configuratorSetQuoteSchema,
} from "@taktyl/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootApp, hasDb, type TestEnv } from "./helpers.js";

describe.skipIf(!hasDb)("F-250..F-254 konfigurator kolorow (PostgreSQL)", () => {
  let t: TestEnv;
  beforeAll(async () => {
    t = await bootApp();
  });
  afterAll(async () => {
    await t.close();
  });

  const quote = async (body: object) =>
    configuratorQuoteSchema.parse(
      (await t.http().post("/v1/configurator/quote").send(body).expect(200)).body,
    );

  it("slowniki: 26 modeli, kolory z bazy, wykonczenia i nadruki", async () => {
    const d = configuratorDataSchema.parse(
      (await t.http().get("/v1/configurator").expect(200)).body,
    );
    expect(d.models).toHaveLength(26);
    expect(Object.keys(d.colors).length).toBeGreaterThan(100);
    expect(d.prints).toHaveLength(27);
    expect(d.finishes.mat?.code).toBe("M");
  });

  it("domyslna konfiguracja: bez doplaty, cena modelu bazowego i SKU", async () => {
    const q = await quote({ model: "k-kwarc-60", parts: {} });
    expect(q.ok).toBe(true);
    expect(q.surcharge_gr).toBe(0);
    expect(q.base_price_gr).toBe(29900);
    expect(q.total_gr).toBe(29900);
    expect(q.sku).toMatch(/^K-KWR60-CFG-/);
    expect(q.made_to_order).toBe(true);
  });

  it("dopłata za wykończenie liczona w groszach po stronie serwera", async () => {
    const q = await quote({
      model: "k-kwarc-60",
      parts: { obudowa: { color: "turkus", finish: "polysk" } },
    });
    expect(q.ok).toBe(true);
    expect(q.surcharge_gr).toBe(4000);
    expect(q.total_gr).toBe(33900);
  });

  it("podkladka: cena rozmiaru i doplata za nadruk", async () => {
    const q = await quote({ model: "p-tafla_l", parts: {}, print: "p-paski" });
    expect(q.ok).toBe(true);
    expect(q.surcharge_gr).toBe(1000);
    expect(q.base_price_gr).toBeGreaterThan(0);
    expect(q.sku).toMatch(/^P-TFL-L-CFG-NPASKI/);
  });

  it("nadruk o slabym kontrascie jest podmieniany i raportowany", async () => {
    const q = await quote({
      model: "k-kwarc-60",
      parts: {
        klawisze_alfa: { color: "mgla", finish: "abs" },
        legendy_alfa: { color: "mgla", finish: null },
      },
    });
    expect(q.adjustments[0]).toMatchObject({ part: "legendy_alfa", from: "mgla" });
  });

  it("niepoprawna konfiguracja: ok=false, bez SKU i ceny", async () => {
    const q = await quote({
      model: "k-granit-tkl",
      parts: { obudowa: { color: "grafit", finish: "polprzezroczyste" } },
    });
    expect(q.ok).toBe(false);
    expect(q.sku).toBeNull();
    expect(q.total_gr).toBe(0);
    const unknown = await quote({ model: "x-nie-ma", parts: {} });
    expect(unknown.ok).toBe(false);
  });

  it("walidacja wejscia: obce pola i zly klucz to 422", async () => {
    await t
      .http()
      .post("/v1/configurator/quote")
      .send({ model: "k-kwarc-60", parts: {}, price: 1 })
      .expect(422);
    await t.http().post("/v1/configurator/quote").send({ model: "K KWARC", parts: {} }).expect(422);
  });

  describe("F-255 wlasny set", () => {
    const setQuote = async (items: object[]) =>
      configuratorSetQuoteSchema.parse(
        (await t.http().post("/v1/configurator/set-quote").send({ items }).expect(200)).body,
      );
    const three = [
      { model: "k-kwarc-60", parts: { obudowa: { color: "turkus", finish: "mat" } } },
      { model: "m-kos", parts: {} },
      { model: "p-tafla_l", parts: {}, print: "p-paski" },
    ];

    it("komplet trzech kategorii: suma, rabat setu z ustawien sklepu i razem", async () => {
      const q = await setQuote(three);
      expect(q.ok).toBe(true);
      expect(q.complete).toBe(true);
      expect(q.sum_gr).toBe(q.items.reduce((a, i) => a + i.total_gr, 0));
      expect(q.discount_gr).toBe(Math.round((q.sum_gr * q.percent) / 100));
      expect(q.total_gr).toBe(q.sum_gr - q.discount_gr);
      expect(q.percent).toBe(10);
    });

    it("bez kompletu (dwie kategorie) nie ma rabatu", async () => {
      const q = await setQuote(three.slice(0, 2));
      expect(q.ok).toBe(true);
      expect(q.complete).toBe(false);
      expect(q.discount_gr).toBe(0);
      expect(q.total_gr).toBe(q.sum_gr);
    });

    it("dwie klawiatury albo niepoprawna konfiguracja: bez rabatu i ok=false", async () => {
      const twice = await setQuote([three[0]!, three[0]!, three[2]!]);
      expect(twice.ok).toBe(false);
      expect(twice.discount_gr).toBe(0);
      const bad = await setQuote([
        three[0]!,
        three[1]!,
        { model: "p-tafla_l", parts: {}, print: "p-nie-ma" },
      ]);
      expect(bad.ok).toBe(false);
      expect(bad.discount_gr).toBe(0);
    });

    it("walidacja: pusta lista to 422", async () => {
      await t.http().post("/v1/configurator/set-quote").send({ items: [] }).expect(422);
    });
  });
});
