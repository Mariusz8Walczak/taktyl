// B-102: testy jednostkowe seeda (bez bazy): walidacja danych zrodlowych, historia cen, parser stron.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsePage } from "./content.js";
import { buildPriceHistory } from "./history.js";
import { loadSeedData, SeedValidationError } from "./load.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

describe("B-102 loadSeedData (data/*.json)", () => {
  const d = loadSeedData(root);

  it("liczby kontrolne z docs/17 par. 6", () => {
    expect(d.categories).toHaveLength(3);
    expect(d.products).toHaveLength(18);
    expect(d.variants).toHaveLength(99);
    expect(d.switches).toHaveLength(4);
    expect(d.colors).toHaveLength(4);
    expect(d.presets).toHaveLength(4);
    expect(d.shop.shipping_methods).toHaveLength(3);
    expect(d.shop.payment_methods).toHaveLength(4);
    expect(d.shop.codes).toHaveLength(2);
    expect(d.shop.pickup_points).toHaveLength(6);
    expect(d.manifest).toHaveLength(190);
    expect(d.manifest.filter((m) => m.priority === "P0")).toHaveLength(76);
  });

  it("kwoty w groszach (Int), przeliczone raz z zl", () => {
    for (const v of d.variants) {
      expect(Number.isInteger(v.priceGr)).toBe(true);
      expect(v.priceGr).toBeGreaterThan(0);
    }
    const granit = d.variants.find((v) => v.sku === "K-GRNTKL-GRF-SLZ");
    expect(granit).toMatchObject({ priceGr: 59900, regularPriceGr: 69900, lowest30dGr: 69900 });
    const wrobel = d.variants.find((v) => v.sku === "M-WRB-GRF");
    expect(wrobel).toMatchObject({ priceGr: 12900, regularPriceGr: 14900, lowest30dGr: 13900 });
  });

  it("promocje tylko Granit TKL (8 wariantow) i Wrobel (2)", () => {
    const promo = d.variants.filter((v) => v.lowest30dGr !== null);
    expect(promo).toHaveLength(10);
    expect(new Set(promo.map((v) => v.productId))).toEqual(new Set(["k-granit-tkl", "m-wrobel"]));
  });

  it("opisy pokrywaja wszystkie produkty, strony tresci wczytane", () => {
    expect(Object.keys(d.descriptions)).toHaveLength(18);
    expect(d.pages.length).toBeGreaterThanOrEqual(5);
    expect(d.pages.every((p) => p.demoNotice && p.bodyMd.length > 100)).toBe(true);
  });

  it("zawiera bledy z nazwa pliku i pola", () => {
    expect(() => loadSeedData(fileURLToPath(new URL("../", import.meta.url)))).toThrow();
    expect(SeedValidationError.name).toBe("SeedValidationError");
  });
});

describe("B-102 buildPriceHistory (docs/17 par. 5)", () => {
  const now = new Date("2026-10-07T10:00:00Z");
  const day = 86_400_000;

  it("bez promocji: jeden otwarty wiersz od seed - 90 dni", () => {
    const rows = buildPriceHistory({ sku: "M-X-GRF", priceGr: 12900, lowest30dGr: null }, now);
    expect(rows).toEqual([
      {
        sku: "M-X-GRF",
        priceGr: 12900,
        validFrom: new Date(now.getTime() - 90 * day),
        validTo: null,
        reason: "seed",
      },
    ]);
  });

  it("promocja: lowest_30d z danych, potem cena biezaca od seed - 2 dni", () => {
    const rows = buildPriceHistory({ sku: "M-WRB-GRF", priceGr: 12900, lowest30dGr: 13900 }, now);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ priceGr: 13900, validTo: new Date(now.getTime() - 2 * day) });
    expect(rows[1]).toMatchObject({
      priceGr: 12900,
      validFrom: new Date(now.getTime() - 2 * day),
      validTo: null,
    });
  });

  it("odrzuca lowest_30d niewyzsze od ceny", () => {
    expect(() =>
      buildPriceHistory({ sku: "M-X-GRF", priceGr: 100, lowest30dGr: 100 }, now),
    ).toThrow(RangeError);
  });
});

describe("B-102 parsePage", () => {
  it("czyta frontmatter i tresc", () => {
    const p = parsePage(
      "---\nslug: test\ntitle: Test\nupdated: 2026-10-07\ndemo: true\n---\n\nTresc\n",
      "x.md",
    );
    expect(p).toEqual({
      slug: "test",
      title: "Test",
      updated: "2026-10-07",
      demoNotice: true,
      bodyMd: "Tresc",
    });
  });

  it("odrzuca brak frontmattera i nieznane pola", () => {
    expect(() => parsePage("Tresc", "x.md")).toThrow(/frontmatter/);
    expect(() =>
      parsePage(
        "---\nslug: t\ntitle: T\nupdated: 2026-10-07\ndemo: true\nextra: 1\n---\nA",
        "x.md",
      ),
    ).toThrow(/frontmatter/);
  });
});
