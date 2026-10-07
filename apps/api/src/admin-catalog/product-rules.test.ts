// B-102, B-103, B-111: testy jednostkowe regul produktu i wariantu (atrybuty per kategoria, SKU, opcje, roznice do audytu).
import { describe, expect, it } from "vitest";
import {
  changedFields,
  gpsrErrors,
  mergeAttributes,
  optionsErrors,
  productIdErrors,
  skuErrors,
  variantShapeErrors,
} from "./product-rules.js";

const PAD = {
  surface: "tkanina",
  material: "poliester",
  thickness_mm: 4,
  edge: "obszyta",
  sizes: { m: { label: "M", w: 300, d: 250, type: "mysz" } },
};

describe("B-102 atrybuty per kategoria", () => {
  it("scala plytko i waliduje calosc schematem kategorii", () => {
    const ok = mergeAttributes("podkladki", PAD, { thickness_mm: 5 });
    expect(ok).toMatchObject({ ok: true, value: { thickness_mm: 5, surface: "tkanina" } });
  });

  it("zly typ i nieznany klucz maja sciezke attributes.*", () => {
    const bad = mergeAttributes("podkladki", PAD, { thickness_mm: -1 });
    expect(bad).toMatchObject({ ok: false });
    expect(!bad.ok && bad.errors[0]?.path).toBe("attributes.thickness_mm");
    const unknown = mergeAttributes("podkladki", PAD, { hotswap: true });
    expect(!unknown.ok && unknown.errors).toEqual([
      { path: "attributes.hotswap", code: "unrecognized_key", message: expect.any(String) },
    ]);
  });
});

describe("B-111 reguly nowego produktu i wariantu", () => {
  it("identyfikator zaczyna sie od litery kategorii, opcje zgodne z kategoria", () => {
    expect(productIdErrors("myszki", "m-sikora")).toEqual([]);
    expect(productIdErrors("myszki", "k-sikora")[0]?.path).toBe("id");
    expect(optionsErrors("klawiatury", ["switch", "color"])).toEqual([]);
    expect(optionsErrors("klawiatury", ["color"])[0]?.path).toBe("options");
    expect(optionsErrors("podkladki", ["size", "color"])).toEqual([]);
  });

  it("ksztalt wariantu: klawiatura wymaga przelacznika, podkladka rozmiaru, myszka obu nie dopuszcza", () => {
    expect(variantShapeErrors("klawiatury", { color: "grafit", switch: "slizg" })).toEqual([]);
    expect(variantShapeErrors("klawiatury", { color: "grafit" })[0]?.path).toBe("switch");
    expect(variantShapeErrors("podkladki", { color: "grafit", size: "m" })).toEqual([]);
    expect(variantShapeErrors("podkladki", { color: "grafit" })[0]?.path).toBe("size");
    expect(
      variantShapeErrors("myszki", { color: "grafit", switch: "slizg", size: "m" }).map(
        (e) => e.path,
      ),
    ).toEqual(["switch", "size"]);
  });

  it("SKU zgodny z kodami koloru, przelacznika i rozmiaru", () => {
    const k = { colorCode: "GRF", switchCode: "SLZ" };
    expect(skuErrors("klawiatury", "K-BZL75-GRF-SLZ", k)).toEqual([]);
    expect(skuErrors("klawiatury", "K-BZL75-MGL-SLZ", k)[0]?.code).toBe("sku_mismatch");
    expect(skuErrors("klawiatury", "M-BZL75-GRF", k)[0]?.code).toBe("sku_mismatch");
    expect(skuErrors("myszki", "M-WRB-GRF", { colorCode: "GRF" })).toEqual([]);
    expect(skuErrors("myszki", "M-WRB-MGL", { colorCode: "GRF" })).toHaveLength(1);
    expect(skuErrors("podkladki", "P-TFL-XL-GRF", { colorCode: "GRF", size: "xl" })).toEqual([]);
    expect(skuErrors("podkladki", "P-TFL-XL-GRF", { colorCode: "GRF", size: "m" })).toHaveLength(1);
  });

  it("kontakt GPSR wylacznie w domenie taktyl.example", () => {
    expect(gpsrErrors({ contact: "bezpieczenstwo@taktyl.example" })).toEqual([]);
    expect(gpsrErrors({ contact: "x@example.com" })[0]?.path).toBe("gpsr.contact");
  });
});

describe("audyt: roznice przed -> po", () => {
  it("zwraca tylko zmienione pola", () => {
    expect(changedFields({ a: 1, b: [1, 2], c: "x" }, { a: 1, b: [1, 3], c: "x" })).toEqual({
      before: { b: [1, 2] },
      after: { b: [1, 3] },
    });
    expect(changedFields({ a: 1 }, { a: 1 })).toEqual({ before: {}, after: {} });
  });
});
