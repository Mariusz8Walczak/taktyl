// F-064, F-063, F-062, F-041, F-070, F-065 (TAKTYL-27, TAKTYL-28): logika katalogu bez DOM, na danych z data/products.json.
import { describe, expect, it } from "vitest";
import { keyParams, specRows, variantSpecRows } from "../src/lib/catalog/attributes";
import { buildCardView } from "../src/lib/catalog/card-view";
import { dispatchTexts } from "../src/lib/catalog/dispatch";
import { packshotsFor, secondShotFor } from "../src/lib/catalog/images";
import { omnibusSentence, priceView, promoBadgeText, stockView } from "../src/lib/catalog/price";
import { productJsonLd } from "../src/lib/catalog/product-view";
import {
  findVariant,
  isBuyable,
  optionStatus,
  resolveVariant,
  selectionOf,
  skuParam,
} from "../src/lib/catalog/variants";
import { cardFixture, COLORS, productFixture, SWITCHES } from "./catalog-fixtures";

const NBSP = "\u00A0";

describe("cena i Omnibus (F-064, S5, S6)", () => {
  it("S5: Granit TKL 599 zł, przekreslona 699 zł, plakietka -14%", () => {
    const p = productFixture("granit-tkl");
    const v = p.variants.find((x) => x.sku === p.default_variant_sku)!;
    const view = priceView(v);
    expect(view.priceGr).toBe(59900);
    expect(view.omnibusGr).toBe(69900);
    expect(view.percent).toBe(14);
    expect(promoBadgeText(14)).toBe("−14%");
    expect(omnibusSentence(69900)).toBe(`Najniższa cena z 30 dni przed obniżką: 699,00${NBSP}zł`);
  });

  it("S6: Wrobel 129 zł, przekreslona 139 zł (nie 149), -7%", () => {
    const p = productFixture("wrobel");
    const v = p.variants.find((x) => x.color === "grafit")!;
    const view = priceView(v);
    expect(view.priceGr).toBe(12900);
    expect(view.omnibusGr).toBe(13900);
    expect(view.percent).toBe(7);
    // regular_price (149 zl) nie istnieje w odpowiedzi publicznej
    expect(JSON.stringify(p)).not.toContain("regular_price");
    expect(JSON.stringify(p)).not.toContain("14900");
  });

  it("bez promocji: brak przekreslenia i plakietki", () => {
    const p = productFixture("bazalt-75");
    const view = priceView(p.variants[0]!);
    expect(view.omnibusGr).toBeNull();
    expect(view.percent).toBeNull();
  });
});

describe("dostepnosc (docs/04 §5.3, S7, S8)", () => {
  it("etykiety i limit ilosci", () => {
    expect(stockView(0)).toMatchObject({ level: "brak", label: "Brak", maxQty: 0 });
    expect(stockView(1).label).toBe(`Ostatnie sztuki (została 1${NBSP}szt.)`);
    expect(stockView(2).label).toBe(`Ostatnie sztuki (zostały 2${NBSP}szt.)`);
    expect(stockView(2).maxQty).toBe(2);
    expect(stockView(3).label).toBe(`Ostatnie sztuki (zostały 3${NBSP}szt.)`);
    expect(stockView(4)).toMatchObject({ level: "dostepny", label: "Dostępny", maxQty: 4 });
    expect(stockView(99).maxQty).toBe(10);
  });

  it("wariant wylaczony traktowany jak brak", () => {
    expect(stockView(20, false)).toMatchObject({ level: "brak", maxQty: 0 });
  });

  it("S8: Jerzyk Mgla - ostatnie sztuki, ilosc maks. 2", () => {
    const p = productFixture("jerzyk");
    const v = p.variants.find((x) => x.sku === "M-JRZ-MGL")!;
    const s = stockView(v.stock);
    expect(s.label).toBe(`Ostatnie sztuki (zostały 2${NBSP}szt.)`);
    expect(s.maxQty).toBe(2);
  });
});

describe("wybor wariantu (F-062, F-063, S7)", () => {
  const p = productFixture("bazalt-75");

  it("S7: Kobalt + Szept to wariant bez stanu", () => {
    const start = p.variants.find((v) => v.sku === p.default_variant_sku)!;
    const kobalt = resolveVariant(p.variants, selectionOf(start), "color", "kobalt")!;
    expect(kobalt.color).toBe("kobalt");
    const szept = resolveVariant(p.variants, selectionOf(kobalt), "switch", "szept")!;
    expect(szept.sku).toBe("K-BZL75-KOB-SZP");
    expect(isBuyable(szept)).toBe(false);
  });

  it("wartosc z kombinacja bez stanu jest oznaczona 'brak', ale wybieralna", () => {
    const sel = selectionOf(p.variants.find((v) => v.sku === "K-BZL75-KOB-PRG")!);
    expect(optionStatus(p.variants, sel, "switch", "szept")).toBe("brak");
    expect(optionStatus(p.variants, sel, "switch", "slizg")).toBe("ok");
  });

  it("wartosc bez zadnego kupowalnego wariantu jest nieaktywna", () => {
    const variants = p.variants.map((v) => (v.color === "kobalt" ? { ...v, stock: 0 } : v));
    const sel = selectionOf(variants.find((v) => v.sku === "K-BZL75-GRF-PRG")!);
    expect(optionStatus(variants, sel, "color", "kobalt")).toBe("niedostepny");
    expect(optionStatus(variants, sel, "color", "mgla")).toBe("ok");
  });

  it("zmiana koloru zachowuje przelacznik, a gdy kombinacji brak - najblizszy wariant", () => {
    const start = p.variants.find((v) => v.sku === "K-BZL75-GRF-PRG")!;
    const next = resolveVariant(p.variants, selectionOf(start), "color", "mgla")!;
    expect(next.color).toBe("mgla");
    expect(next.switch).toBe("prog");
    expect(findVariant(p.variants, selectionOf(next))).toBe(next);
  });

  it("adres kanoniczny bez parametru (?sku= tylko dla wariantu innego niz domyslny)", () => {
    expect(skuParam("K-BZL75-GRF-SLZ", "K-BZL75-GRF-SLZ")).toBeNull();
    expect(skuParam("K-BZL75-KOB-PRG", "K-BZL75-GRF-SLZ")).toBe("K-BZL75-KOB-PRG");
  });
});

describe("karta na listingu (F-040, F-041, F-044)", () => {
  const ctx = { colors: COLORS, switches: SWITCHES };

  it("Granit TKL: promocja z Omnibusem, plakietka -14%, adres bez parametru", () => {
    const p = productFixture("granit-tkl");
    const view = buildCardView(cardFixture(p), p, ctx);
    expect(view.priceGr).toBe(59900);
    expect(view.omnibusGr).toBe(69900);
    expect(view.omnibusText).toContain("699,00");
    expect(view.badges.find((b) => b.variant === "promocja")?.text).toBe("−14%");
    expect(view.href).toBe("/klawiatury/granit-tkl");
    expect(view.params).toHaveLength(3);
  });

  it("filtr wariantowy: adres niesie ?sku= dopasowanego wariantu", () => {
    const p = productFixture("bazalt-75");
    const view = buildCardView(cardFixture(p, "K-BZL75-KOB-PRG"), p, ctx);
    expect(view.href).toBe("/klawiatury/bazalt-75?sku=K-BZL75-KOB-PRG");
    expect(view.sku).toBe("K-BZL75-KOB-PRG");
    expect(view.colorName).toBe("Kobalt");
  });

  it("Kreda 98: ostatnie sztuki tylko z danych (stan <= 3 wariantu z cena listingu)", () => {
    const p = productFixture("kreda-98");
    const view = buildCardView(cardFixture(p), p, ctx);
    const cheapest = [...p.variants]
      .filter((v) => v.stock > 0)
      .sort((a, b) => a.price_gr - b.price_gr || a.sku.localeCompare(b.sku))[0]!;
    expect(view.badges.some((b) => b.variant === "ostatnie-sztuki")).toBe(
      cheapest.stock >= 1 && cheapest.stock <= 3,
    );
  });

  it("parametry kluczowe to atrybuty bez przymiotnikow (F-041)", () => {
    const k = productFixture("bazalt-75");
    expect(keyParams(k, SWITCHES).map((x) => x.label)).toEqual([
      "Rozmiar",
      "Łączność",
      "Przełączniki",
    ]);
    expect(keyParams(k, SWITCHES)[1]!.value).toBe("przewód USB-C, 2,4 GHz, Bluetooth");
    const m = productFixture("jerzyk");
    expect(keyParams(m, SWITCHES).map((x) => x.label)).toEqual(["Waga", "Kształt", "Dłoń"]);
    expect(keyParams(m, SWITCHES)[0]!.value).toMatch(/^\d+\u00A0g$/);
    const pad = productFixture("tafla");
    expect(keyParams(pad, SWITCHES).map((x) => x.label)).toEqual([
      "Powierzchnia",
      "Rozmiary",
      "Materiał",
    ]);
    expect(keyParams(pad, SWITCHES)[1]!.value).toBe("M, L, XL, XXL");
  });
});

describe("zdjecia z manifestu (F-060, A-09)", () => {
  const p = productFixture("bazalt-75");
  it("ujecia wariantu: 01-34 pierwsze, 4 ujecia na kolor", () => {
    const shots = packshotsFor(p.images, p.id, "grafit");
    expect(shots.map((s) => s.shot)).toEqual(["01-34", "02-gora", "03-bok", "04-detal"]);
  });
  it("A-09: drugie ujecie tylko gdy gotowe (manifest ma status brak = pominiete)", () => {
    expect(secondShotFor(p.images, p.id, "grafit")).toBeNull();
    const ready = productFixture("bazalt-75", "gotowe");
    expect(secondShotFor(ready.images, ready.id, "grafit")?.shot).toBe("02-gora");
  });
});

describe("specyfikacja (F-070, docs/04 §4)", () => {
  it("klawiatura: formaty i etykiety, wiersz z null ukryty", () => {
    const rows = Object.fromEntries(
      specRows(productFixture("bazalt-75")).map((r) => [r.label, r.value]),
    );
    expect(rows["Rozmiar"]).toBe("75%");
    expect(rows["Waga"]).toBe(`1,85${NBSP}kg`);
    expect(rows["Wymiary (szer. × gł. × wys.)"]).toBe(`32,7 × 14 × 3,6${NBSP}cm`);
    expect(rows["Wymiana przełączników bez lutowania"]).toBe("tak");
    expect(rows["Łączność"]).toBe("przewód USB-C, 2,4 GHz, Bluetooth");
  });

  it("myszka: dlon, DPI i Hz z twarda spacja", () => {
    const rows = Object.fromEntries(
      specRows(productFixture("jerzyk")).map((r) => [r.label, r.value]),
    );
    expect(rows["Długość dłoni"]).toMatch(/^[\d,]+–[\d,]+\u00A0cm$/);
    expect(rows["Rozdzielczość maks."]).toMatch(/DPI$/);
    expect(rows["Rozdzielczość maks."]).toContain(NBSP);
    expect(rows["Ręka"]).toMatch(/dla praworęcznych|oburęczna/);
  });

  it("wiersze zalezne od wariantu: przelacznik i rozmiar podkladki", () => {
    const k = productFixture("bazalt-75");
    const v = k.variants.find((x) => x.sku === "K-BZL75-GRF-PRG")!;
    expect(variantSpecRows({ category: "klawiatury" }, v, SWITCHES)).toEqual([
      { label: "Przełącznik", value: `Próg (taktylny, 55${NBSP}g)` },
    ]);
    const pad = productFixture("tafla");
    const xl = pad.variants.find((x) => x.size === "xl")!;
    const sizes = (
      pad.attributes as unknown as {
        sizes: Record<string, { label: string; w: number; d: number; type: string }>;
      }
    ).sizes;
    const rows = variantSpecRows({ category: "podkladki", sizes }, xl, SWITCHES);
    expect(rows[0]!.value).toBe(`XL · 90 × 40${NBSP}cm`);
    expect(rows[1]!.value).toBe("na całe biurko");
  });
});

describe("dane strukturalne Product (F-078)", () => {
  it("offers dla domyslnego wariantu, bez aggregateRating i review", () => {
    const p = productFixture("granit-tkl");
    const v = p.variants.find((x) => x.sku === p.default_variant_sku)!;
    const ld = productJsonLd(p, v) as {
      offers: { price: string; priceCurrency: string; availability: string };
    };
    expect(ld.offers.price).toBe("599.00");
    expect(ld.offers.priceCurrency).toBe("PLN");
    expect(ld.offers.availability).toBe("https://schema.org/InStock");
    const json = JSON.stringify(ld);
    expect(json).not.toMatch(/aggregateRating|review/i);
  });

  it("wariant bez stanu to OutOfStock", () => {
    const p = productFixture("bazalt-75");
    const v = p.variants.find((x) => x.sku === "K-BZL75-KOB-SZP")!;
    expect((productJsonLd(p, v) as { offers: { availability: string } }).offers.availability).toBe(
      "https://schema.org/OutOfStock",
    );
  });
});

describe("termin wysylki (F-065, Europe/Warsaw)", () => {
  const opts = { cutoffHour: 14, timeZone: "Europe/Warsaw" };
  it("sroda 13:00: wysylka dzis, dostawa czwartek, 8 pazdziernika", () => {
    const t = dispatchTexts(
      {
        dispatch_date: "2026-10-07",
        delivery_date: "2026-10-08",
        dispatches_today: true,
        computed_at: "2026-10-07T13:00:00+02:00",
      },
      opts,
    );
    expect(t.headline).toBe("Wysyłka dziś");
    expect(t.message).toBe(
      "Zamów do 14:00, wyślemy dziś. Dostawa kurierem: czwartek, 8 października.",
    );
  });
  it("sroda 15:00: wysylka jutro, dostawa piatek 9 pazdziernika", () => {
    const t = dispatchTexts(
      {
        dispatch_date: "2026-10-08",
        delivery_date: "2026-10-09",
        dispatches_today: false,
        computed_at: "2026-10-07T15:00:00+02:00",
      },
      opts,
    );
    expect(t.headline).toBe("Wysyłka jutro");
    expect(t.message).toContain("piątek, 9 października");
  });
  it("sobota: wysylka w poniedzialek 12, dostawa wtorek 13 pazdziernika", () => {
    const t = dispatchTexts(
      {
        dispatch_date: "2026-10-12",
        delivery_date: "2026-10-13",
        dispatches_today: false,
        computed_at: "2026-10-10T10:00:00+02:00",
      },
      opts,
    );
    expect(t.headline).toBe("Wysyłka: poniedziałek, 12 października");
    expect(t.message).toContain("wtorek, 13 października");
  });
});
