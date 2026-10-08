// F-242 (docs/10 §3, §7 pkt 2): buildery items[]; suma discount = rabat setu (preset "Programista").
import { describe, expect, it } from "vitest";
import {
  buildItem,
  grToZl,
  itemsDiscount,
  itemsValue,
  vatIncludedGr,
} from "../src/lib/track-items";
import { buildSetItems } from "../src/lib/track-set-items";

const programista = [
  {
    sku: "K-BZL75-GRF-PRG",
    name: "Bazalt 75",
    category: "klawiatury",
    variant: "Grafit / Próg",
    priceGr: 74900,
  },
  { sku: "M-PST-GRF", name: "Pustułka", category: "myszki", variant: "Grafit", priceGr: 39900 },
  {
    sku: "P-SZR-XL-GRF",
    name: "Szron XL",
    category: "podkladki",
    variant: "XL / Grafit",
    priceGr: 18900,
  },
];

describe("items[] (docs/10 §3)", () => {
  it("pozycja poza setem: discount 0, brak promotion_name, kwoty jako liczby", () => {
    const i = buildItem({
      ...programista[0]!,
      listId: "klawiatury",
      listName: "Klawiatury",
      index: 0,
    });
    expect(i).toEqual({
      item_id: "K-BZL75-GRF-PRG",
      item_name: "Bazalt 75",
      item_brand: "Taktyl",
      item_category: "klawiatury",
      item_variant: "Grafit / Próg",
      price: 749,
      quantity: 1,
      discount: 0,
      item_list_id: "klawiatury",
      item_list_name: "Klawiatury",
      index: 0,
    });
    expect(i).not.toHaveProperty("promotion_name");
  });

  it("set Programista: rabat 133,70 zl rozbity 74,90 / 39,90 / 18,90, suma = rabat setu", () => {
    const items = buildSetItems(programista, 13370, "Rabat za set 10%");
    expect(items.map((i) => i.discount)).toEqual([74.9, 39.9, 18.9]);
    expect(items.every((i) => i.promotion_name === "Rabat za set 10%")).toBe(true);
    expect(itemsDiscount(items)).toBe(133.7);
    expect(itemsValue(items)).toBe(1203.3);
  });

  it("rozbicie z reszta groszowa: suma zawsze rowna rabatowi", () => {
    const lines = [
      { ...programista[0]!, priceGr: 33333 },
      { ...programista[1]!, priceGr: 11111 },
      { ...programista[2]!, priceGr: 5557 },
    ];
    const items = buildSetItems(lines, 4999, "Rabat za set 10%");
    expect(Math.round(itemsDiscount(items) * 100)).toBe(4999);
  });

  it("grToZl i VAT: grosze calkowite, value*23/123 w groszach", () => {
    expect(grToZl(74990)).toBe(749.9);
    expect(grToZl(120330)).toBe(1203.3);
    expect(() => grToZl(10.5)).toThrow(RangeError);
    expect(vatIncludedGr(120330)).toBe(22501);
  });
});
