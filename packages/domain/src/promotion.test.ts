// B-104, B-106 (TAKTYL-51): parsowanie kwoty w zlotych i podglad promocji (B-S2, S5, S6).
import { describe, expect, it } from "vitest";
import { formatZlotyInput, parseZlotyInput } from "./money-input.js";
import {
  computePromotion,
  previewPriceChange,
  promotionPercent,
  type PriceRow,
} from "./promotion.js";

const DAY = 86_400_000;
const NOW = new Date("2026-10-07T10:00:00Z");
const ago = (d: number): Date => new Date(NOW.getTime() - d * DAY);
const row = (priceGr: number, from: number, to: number | null): PriceRow => ({
  priceGr,
  validFrom: ago(from),
  validTo: to === null ? null : ago(to),
});

describe("B-104 parseZlotyInput", () => {
  it.each([
    ["749", 74900],
    ["749,00", 74900],
    ["749.5", 74950],
    ["1 299,99", 129999],
    ["1 299,99", 129999],
    ["0,01", 1],
    ["119,0", 11900],
  ])("%s -> %i gr", (text, gr) => expect(parseZlotyInput(text)).toBe(gr));

  it.each(["", "abc", "-5", "12,345", "12,", ",50", "1e3", "12 zł"])("odrzuca %s", (text) =>
    expect(parseZlotyInput(text)).toBeNull(),
  );

  it("formatZlotyInput daje dwa miejsca po przecinku bez separatora tysiecy", () => {
    expect(formatZlotyInput(74900)).toBe("749,00");
    expect(formatZlotyInput(129999)).toBe("1299,99");
    expect(parseZlotyInput(formatZlotyInput(12345))).toBe(12345);
  });
});

describe("B-106 podglad promocji", () => {
  it("B-S2: Wrobel 129 zl (obnizony z 139) -> 119 zl: -14%, najnizsza 139,00 zl", () => {
    const history = [row(13900, 90, 2), row(12900, 2, null)];
    const p = previewPriceChange(history, 11900, NOW);
    expect(p.lowest30dGr).toBe(13900);
    expect(p.percent).toBe(14);
  });

  it("Granit TKL 599 zl po obnizce z 699 zl: -14%", () => {
    expect(promotionPercent(69900, 59900)).toBe(14);
  });

  it("obnizka produktu bez promocji tworzy odniesienie z biezacej ceny", () => {
    const p = previewPriceChange([row(74900, 90, null)], 69900, NOW);
    expect(p.lowest30dGr).toBe(74900);
    expect(p.percent).toBe(6);
  });

  it("podwyzka lub ta sama cena = brak nowej promocji", () => {
    expect(previewPriceChange([row(10000, 90, null)], 12000, NOW).lowest30dGr).toBeNull();
    expect(previewPriceChange([row(10000, 90, null)], 10000, NOW).lowest30dGr).toBeNull();
  });

  it("ta sama cena w trwajacej promocji zachowuje obecne odniesienie", () => {
    const history = [row(13900, 90, 2), row(12900, 2, null)];
    expect(previewPriceChange(history, 12900, NOW).lowest30dGr).toBe(13900);
  });

  it("computePromotion: lancuch obnizek nie resetuje okna", () => {
    const r = computePromotion([row(10000, 90, 10), row(9000, 10, 3), row(8000, 3, null)], NOW);
    expect(r.lowest30dGr).toBe(10000);
  });
});
