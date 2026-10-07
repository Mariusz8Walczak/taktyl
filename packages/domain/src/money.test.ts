// Testy F-064, F-107, F-025 wg docs/12 par. 2 (formatowanie, liczebniki).
import { describe, expect, it } from "vitest";
import {
  formatCmFromMm,
  formatCount,
  formatDimensionsCm,
  formatMmAsCm,
  formatNumber,
  formatPLN,
  formatPLNSigned,
  formatRangeWithUnit,
  formatWeight,
  formatWithUnit,
  PRODUCT_FORMS,
  pluralize,
  toGrosze,
  applyNbsp,
} from "./index.js";
import { readData } from "./test-utils.js";

const NBSP = "\u00A0";

describe("toGrosze (F-155)", () => {
  it("zamienia zlote z JSON na calkowite grosze", () => {
    expect(toGrosze(1203.3)).toBe(120330);
    expect(toGrosze(133.7)).toBe(13370);
    expect(toGrosze(12.99)).toBe(1299);
    expect(toGrosze(0)).toBe(0);
  });

  it("kazda cena w products.json i presets.json daje liczbe calkowita", () => {
    const products = readData<{ variants: { price: number; lowest_30d: number | null }[] }[]>("products");
    for (const p of products) {
      for (const v of p.variants) {
        expect(Number.isInteger(toGrosze(v.price))).toBe(true);
        if (v.lowest_30d !== null) expect(Number.isInteger(toGrosze(v.lowest_30d))).toBe(true);
      }
    }
    const presets = readData<{ sum: number; set_discount: number; total: number }[]>("presets");
    for (const s of presets) {
      expect(toGrosze(s.sum) - toGrosze(s.set_discount)).toBe(toGrosze(s.total));
    }
  });

  it("odrzuca wartosci nieskonczone", () => {
    expect(() => toGrosze(Number.NaN)).toThrow(RangeError);
  });
});

describe("formatPLN (wynik Intl, nie reczny)", () => {
  it("1203.3 zl -> 1203,30 zl", () => {
    expect(formatPLN(120330)).toBe(`1203,30${NBSP}zł`);
  });

  it("12999 zl -> 12 999,00 zl (twarda spacja z Intl)", () => {
    const expected = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(12999);
    expect(formatPLN(1299900)).toBe(expected);
    expect(formatPLN(1299900)).toMatch(/^12\s999,00\szł$/u);
  });

  it("odrzuca kwoty niecalkowite", () => {
    expect(() => formatPLN(10.5)).toThrow(RangeError);
  });

  it("wersja ze znakiem: propozycja +50,00 zl, zero bez znaku", () => {
    expect(formatPLNSigned(5000)).toBe(`+50,00${NBSP}zł`);
    expect(formatPLNSigned(0)).toBe(`0,00${NBSP}zł`);
    expect(formatPLNSigned(-13370)).toMatch(/^[-−]133,70\szł$/u);
  });
});

describe("liczby z jednostkami", () => {
  it("26000 DPI -> 26 000 DPI", () => {
    expect(formatWithUnit(26000, "DPI")).toBe(`${formatNumber(26000)}${NBSP}DPI`);
    expect(formatWithUnit(26000, "DPI")).toMatch(/^26\s000\u00A0DPI$/u);
  });

  it("mm na cm z przecinkiem dziesietnym", () => {
    expect(formatCmFromMm(283)).toBe("28,3");
    expect(formatCmFromMm(220)).toBe("22");
    expect(formatMmAsCm(327)).toBe(`32,7${NBSP}cm`);
  });

  it("zakres dloni, waga, wymiary (docs/04 par. 4)", () => {
    expect(formatRangeWithUnit(18, 20.5, "cm")).toBe(`18–20,5${NBSP}cm`);
    expect(formatWeight(590)).toBe(`590${NBSP}g`);
    expect(formatWeight(1850)).toBe(`1,85${NBSP}kg`);
    expect(formatDimensionsCm([327, 140, 36])).toBe(`32,7 × 14 × 3,6${NBSP}cm`);
  });
});

describe("liczebniki (F-025)", () => {
  const cases: [number, string][] = [
    [0, "0 produktów"],
    [1, "1 produkt"],
    [2, "2 produkty"],
    [5, "5 produktów"],
    [12, "12 produktów"],
    [22, "22 produkty"],
    [112, "112 produktów"],
  ];
  it.each(cases)("%i -> %s", (n, expected) => {
    expect(formatCount(n, PRODUCT_FORMS)).toBe(expected);
  });

  it("23, 24, 25, 101, 102 odmieniaja sie poprawnie", () => {
    expect(pluralize(23, PRODUCT_FORMS)).toBe("produkty");
    expect(pluralize(24, PRODUCT_FORMS)).toBe("produkty");
    expect(pluralize(25, PRODUCT_FORMS)).toBe("produktów");
    expect(pluralize(101, PRODUCT_FORMS)).toBe("produktów");
    expect(pluralize(102, PRODUCT_FORMS)).toBe("produkty");
  });
});

describe("twarde spacje (docs/01 par. 4)", () => {
  it("laczy liczbe z jednostka i jednoliterowe spojniki", () => {
    expect(applyNbsp("Waga 49 g i 90 cm")).toBe(`Waga 49${NBSP}g i${NBSP}90${NBSP}cm`);
    expect(applyNbsp("Set w kolorze Kobalt")).toBe(`Set w${NBSP}kolorze Kobalt`);
    expect(applyNbsp("299 złotych")).toBe("299 złotych");
  });
});
