// Testy F-107, F-110, F-152, F-153, F-154, F-155: wycena setu i koszyka (docs/12 par. 2, docs/03 par. 6).
import { describe, expect, it } from "vitest";
import {
  allocateDiscount,
  priceSet,
  promotionBadgePercent,
  quoteCart,
  setDiscountAmount,
  stockLevel,
  toGrosze,
  type CartEntry,
  type SetItem,
} from "./index.js";
import { loadCatalog, readData } from "./test-utils.js";

const cat = loadCatalog();

interface Preset {
  id: string;
  skus: string[];
  sum: number;
  set_discount: number;
  total: number;
}
const presets = readData<Preset[]>("presets");

function itemsOf(skus: string[]): SetItem[] {
  return skus.map((sku) => {
    const e = cat.index.get(sku);
    if (!e) throw new Error(`Brak SKU ${sku}`);
    return { sku, category: e.product.category, price: e.variant.price };
  });
}

describe("ceny setow z presets.json (F-107)", () => {
  it.each(presets.map((p) => [p.id, p] as const))("preset %s zgodny co do grosza", (_id, p) => {
    const price = priceSet(itemsOf(p.skus), cat.shop.setDiscount);
    expect(price.complete).toBe(true);
    expect(price.sum).toBe(toGrosze(p.sum));
    expect(price.discount).toBe(toGrosze(p.set_discount));
    expect(price.total).toBe(toGrosze(p.total));
    expect(price.savings).toBe(price.discount);
    // suma rozbicia rabatu = rabat; pozycje: netto = cena - rabat
    expect(price.lines.reduce((a, l) => a + l.discount, 0)).toBe(price.discount);
    expect(price.lines.reduce((a, l) => a + l.net, 0)).toBe(price.total);
  });

  it("4 sety: 1337,00 -> 1203,30; 887,00 -> 798,30; 1007,00 -> 906,30; 857,00 -> 771,30 (docs/03 par. 6)", () => {
    expect(presets).toHaveLength(4);
    const totals = presets.map((p) => priceSet(itemsOf(p.skus), cat.shop.setDiscount).total);
    expect(totals).toEqual([120330, 79830, 90630, 77130]);
  });
});

describe("rabat setu - zaokraglenia i rozbicie", () => {
  it("polowki groszy zaokraglane w gore", () => {
    expect(setDiscountAmount(133705, 10)).toBe(13371);
    expect(setDiscountAmount(133704, 10)).toBe(13370);
  });

  it("rozbicie: reszta groszy trafia na ostatnia pozycje, suma rozbicia = rabat (losowe ceny)", () => {
    for (let n = 0; n < 500; n++) {
      const prices = [0, 1, 2].map(() => 1 + Math.floor(Math.random() * 99999));
      const sum = prices.reduce((a, b) => a + b, 0);
      const discount = setDiscountAmount(sum, 10);
      const parts = allocateDiscount(prices, discount);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(discount);
      parts.slice(0, -1).forEach((part, i) => {
        expect(part).toBe(Math.floor(((prices[i] as number) * discount) / sum));
      });
      expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
    }
  });

  it("rabat od ceny aktualnej, nie regular_price ani lowest_30d (pulapka 21)", () => {
    const promo = cat.bySlug("granit-tkl").variants.find((v) => v.lowest30d !== null);
    if (!promo) throw new Error("Brak wariantu w promocji w danych");
    expect(promo.regularPrice).not.toBe(promo.price);
    const items: SetItem[] = [
      { sku: promo.sku, category: "klawiatury", price: promo.price },
      ...itemsOf(["M-PST-GRF", "P-SZR-XL-GRF"]),
    ];
    const sum = items.reduce((a, i) => a + i.price, 0);
    const price = priceSet(items, cat.shop.setDiscount);
    expect(price.sum).toBe(sum);
    expect(price.discount).toBe(Math.round((sum * 10) / 100));
    const sumOnRegular = sum - promo.price + (promo.regularPrice ?? promo.price);
    expect(price.discount).not.toBe(Math.round((sumOnRegular * 10) / 100));
  });

  it("niepelny set (bez podkladki) nie dostaje rabatu", () => {
    const p = presets[0] as Preset;
    const price = priceSet(itemsOf(p.skus.slice(0, 2)), cat.shop.setDiscount);
    expect(price.complete).toBe(false);
    expect(price.discount).toBe(0);
    expect(price.total).toBe(price.sum);
  });
});

describe("plakietka promocji i dostepnosc (docs/04 par. 5)", () => {
  it("Granit TKL -14%, Wrobel -7%, przekreslona lowest_30d", () => {
    const granit = cat.bySlug("granit-tkl").variants[0];
    const wrobel = cat.bySlug("wrobel").variants[0];
    if (!granit || !wrobel) throw new Error("brak wariantow");
    expect(promotionBadgePercent(granit)).toBe(14);
    expect(promotionBadgePercent(wrobel)).toBe(7);
    expect(wrobel.lowest30d).toBe(toGrosze(139));
  });

  it("poziomy stanu: 0 brak, 1-3 ostatnie, 4+ dostepny", () => {
    expect([0, 1, 3, 4].map(stockLevel)).toEqual(["brak", "ostatnie", "ostatnie", "dostepny"]);
  });
});

describe("wycena koszyka (F-152...F-155)", () => {
  const programista = presets.find((p) => p.id === "programista") as Preset;
  const setEntry = (qty = 1): CartEntry => ({
    type: "set",
    id: "set-1",
    qty,
    items: programista.skus.map((sku) => ({ sku })),
  });
  const quote = (entries: CartEntry[], code?: string, shippingMethodId?: string) =>
    quoteCart({
      entries,
      index: cat.index,
      config: cat.shop,
      code: code ?? null,
      shippingMethodId: shippingMethodId ?? null,
    });
  const wrobelSku = (cat.bySlug("wrobel").variants[0] as { sku: string }).sku;
  const kwarc = cat.bySlug("kwarc-60").variants[0] as { sku: string; price: number };

  it("S12: sam set, dostawa darmowa, razem 1203,30 zl", () => {
    const q = quote([setEntry()], undefined, "kurier");
    expect(q.productsValue).toBe(133700);
    expect(q.setDiscount).toBe(13370);
    expect(q.afterDiscounts).toBe(120330);
    expect(q.shippingFree).toBe(true);
    expect(q.shipping).toBe(0);
    expect(q.total).toBe(120330);
  });

  it("ilosc dotyczy calej grupy", () => {
    const q = quote([setEntry(2)]);
    expect(q.setDiscount).toBe(26740);
    expect(q.total).toBe(240660);
  });

  it("S13: TAKTYL10 przy samym secie - bez rabatu kodu, status sets-only", () => {
    const q = quote([setEntry()], "taktyl10");
    expect(q.codeDiscount).toBe(0);
    expect(q.codeStatus).toBe("sets-only");
    expect(q.total).toBe(120330);
  });

  it("S14: set + Tafla M Grafit osobno + TAKTYL10 -> kod -6,90 zl, razem 1265,40 zl", () => {
    const q = quote([setEntry(), { type: "item", sku: "P-TFL-M-GRF", qty: 1 }], "TAKTYL10");
    expect(q.codeStatus).toBe("applied");
    expect(q.codeDiscount).toBe(690);
    expect(q.total).toBe(126540);
  });

  it("S16: sam Wrobel -> brakuje 170,00 zl do darmowej dostawy", () => {
    const q = quote([{ type: "item", sku: wrobelSku, qty: 1 }], undefined, "automat");
    expect(q.freeShippingRemaining).toBe(17000);
    expect(q.shippingFree).toBe(false);
    expect(q.shipping).toBe(1299);
    expect(q.total).toBe(12900 + 1299);
  });

  it("prog darmowej dostawy liczony po rabatach (299 zl przed kodem, ponizej po kodzie)", () => {
    expect(kwarc.price).toBe(cat.shop.freeShippingThreshold);
    const bez = quote([{ type: "item", sku: kwarc.sku, qty: 1 }]);
    expect(bez.shippingFree).toBe(true);
    const z = quote([{ type: "item", sku: kwarc.sku, qty: 1 }], "TAKTYL10");
    expect(z.afterDiscounts).toBe(kwarc.price - 2990);
    expect(z.freeShippingRemaining).toBe(2990);
  });

  it("DOSTAWA0 daje darmowa dostawe, nieznany kod ma status unknown", () => {
    const entry: CartEntry = { type: "item", sku: wrobelSku, qty: 1 };
    expect(quote([entry], "DOSTAWA0", "kurier").shipping).toBe(0);
    expect(quote([entry], "XYZ").codeStatus).toBe("unknown");
  });

  it("zglasza wariant bez stanu i nieznane SKU", () => {
    const q = quote([
      { type: "item", sku: "K-BZL75-KOB-SZP", qty: 1 },
      { type: "item", sku: "X-NIE-MA", qty: 1 },
    ]);
    expect(q.issues).toEqual([
      { sku: "K-BZL75-KOB-SZP", kind: "out-of-stock" },
      { sku: "X-NIE-MA", kind: "unknown-sku" },
    ]);
  });
});
