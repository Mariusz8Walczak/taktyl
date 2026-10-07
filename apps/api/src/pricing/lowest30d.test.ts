// B-214 (docs/17 par. 5): testy algorytmu lowest_30d - S5, S6, lancuch obnizek, wzrost ceny, cena niezmieniona > 30 dni.
import { describe, expect, it } from "vitest";
import { computePromotion, type PriceRow } from "./lowest30d.js";

const DAY = 86_400_000;
const NOW = new Date("2026-10-07T10:00:00Z");
const ago = (d: number): Date => new Date(NOW.getTime() - d * DAY);
const row = (priceGr: number, from: number, to: number | null): PriceRow => ({
  priceGr,
  validFrom: ago(from),
  validTo: to === null ? null : ago(to),
});

describe("B-214 computePromotion", () => {
  it("S5: Granit TKL 599 zl po obnizce z 699 zl - lowest 69900", () => {
    const r = computePromotion([row(69900, 90, 2), row(59900, 2, null)], NOW);
    expect(r.lowest30dGr).toBe(69900);
  });

  it("S6: Wrobel 129 zl po obnizce z 139 zl - lowest 13900 (nie 14900)", () => {
    expect(computePromotion([row(13900, 90, 2), row(12900, 2, null)], NOW).lowest30dGr).toBe(13900);
  });

  it("brak historii obnizki: jeden wiersz = brak promocji", () => {
    expect(computePromotion([row(74900, 90, null)], NOW).lowest30dGr).toBeNull();
  });

  it("zmiana ceny w gore = brak promocji", () => {
    expect(computePromotion([row(10000, 90, 2), row(12000, 2, null)], NOW).lowest30dGr).toBeNull();
  });

  it("obnizka starsza niz 30 dni = nowa cena zwykla", () => {
    expect(computePromotion([row(10000, 90, 40), row(9000, 40, null)], NOW).lowest30dGr).toBeNull();
  });

  it("lancuch obnizek: kolejna obnizka nie resetuje okna (punkt odniesienia = cena przed pierwsza)", () => {
    const r = computePromotion([row(10000, 90, 10), row(9000, 10, 3), row(8000, 3, null)], NOW);
    expect(r.lowest30dGr).toBe(10000);
    expect(r.cutAt?.getTime()).toBe(ago(10).getTime());
  });

  it("obnizki oddzielone o 30+ dni to osobne promocje (liczy sie ostatnia)", () => {
    const r = computePromotion([row(10000, 120, 50), row(9000, 50, 3), row(8500, 3, null)], NOW);
    expect(r.lowest30dGr).toBe(9000);
  });

  it("cena spadla i wrocila do poziomu sprzed obnizki = brak promocji", () => {
    const r = computePromotion([row(10000, 90, 8), row(9000, 8, 5), row(10000, 5, null)], NOW);
    expect(r.lowest30dGr).toBeNull();
  });

  it("lowest to MIN z okna 30 dni przed obnizka (nizsza cena z okna, nadal wyzsza od biezacej)", () => {
    const r = computePromotion([row(9500, 60, 20), row(11000, 20, 2), row(9000, 2, null)], NOW);
    expect(r.lowest30dGr).toBe(9500);
  });

  it("nizsza cena w oknie niz biezaca = brak promocji (docs/17 par. 5 pkt 3)", () => {
    const r = computePromotion([row(9500, 60, 20), row(11000, 20, 2), row(10000, 2, null)], NOW);
    expect(r.lowest30dGr).toBeNull();
  });
});
