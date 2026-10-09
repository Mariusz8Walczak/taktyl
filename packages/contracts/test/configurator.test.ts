// F-250..F-256 (ADR-0011): kontrakty konfiguratora i kodow konfiguracji w koszyku.
import { describe, expect, it } from "vitest";
import {
  cartSkuSchema,
  configSkuSchema,
  configurationSchema,
  orderItemSchema,
  quoteRequestSchema,
} from "../src/index";

const K = "K-KWR60-CFG-TRKP.KRMB.TRKB.KORB.BIA.MGL.BIA.BIA.PRG";
const P = "P-TFL-L-CFG-NPASKI.GRFN";

describe("kod konfiguracji wlasnej", () => {
  it("configSkuSchema przyjmuje klawiature, mysz i podkladke z rozmiarem", () => {
    for (const sku of [K, "M-KOS-CFG-GRFM.GRFM.GRFP.CZRM", P])
      expect(configSkuSchema.safeParse(sku).success).toBe(true);
  });

  it("odrzuca kody bez CFG, z malymi literami albo bez rozmiaru podkladki", () => {
    for (const sku of [
      "K-KWR60-GRF-SLZ",
      "k-kwr60-cfg-trkp",
      "P-TFL-CFG-GRFN",
      "K-KWR60-CFG-",
      "K-KWR60-CFG-AB",
    ]) {
      expect(configSkuSchema.safeParse(sku).success, sku).toBe(false);
    }
  });

  it("cartSkuSchema przyjmuje zwykle SKU i kody konfiguracji", () => {
    expect(cartSkuSchema.safeParse("K-BZL75-GRF-PRG").success).toBe(true);
    expect(cartSkuSchema.safeParse(K).success).toBe(true);
    expect(cartSkuSchema.safeParse("cokolwiek").success).toBe(false);
  });

  it("zadanie wyceny koszyka z konfiguracja w pozycji i w secie", () => {
    const ok = quoteRequestSchema.safeParse({
      items: [
        { type: "item", sku: K, qty: 1 },
        { type: "set", id: "s1", qty: 1, skus: [K, "M-PST-GRF", P] },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it("pozycja zamowienia moze niesc config_sku", () => {
    const item = {
      group_id: null,
      sku: "K-KWR60-GRF-PRG",
      name: "Kwarc 60 (własne kolory)",
      variant_label: "Obudowa: Turkus",
      config_sku: K,
      qty: 1,
      unit_price_gr: 33900,
      set_discount_gr: 0,
      coupon_discount_gr: 0,
    };
    expect(orderItemSchema.safeParse(item).success).toBe(true);
    expect(orderItemSchema.safeParse({ ...item, config_sku: "K-ZLY" }).success).toBe(false);
  });
});

describe("configurationSchema", () => {
  it("przyjmuje przelacznik i klucze czesci z podkresleniem, odrzuca obce pola", () => {
    expect(
      configurationSchema.safeParse({
        model: "p-tafla_l",
        parts: { legendy_alfa: { color: "auto", finish: null } },
        print: "p-paski",
        switch: "prog",
      }).success,
    ).toBe(true);
    expect(
      configurationSchema.safeParse({ model: "k-kwarc-60", parts: {}, price: 1 }).success,
    ).toBe(false);
  });
});
