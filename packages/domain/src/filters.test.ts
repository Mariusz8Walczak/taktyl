// Testy F-021...F-025: filtry, facety, sortowanie i adres; odtwarzaja S1-S4 z docs/12 na products.json.
import { describe, expect, it } from "vitest";
import {
  activeFilterChips,
  computeFacets,
  filterProducts,
  listingPrice,
  parseListingQuery,
  queryListing,
  removeChip,
  serializeListingQuery,
  sortListing,
  type ColorsConfig,
  type FacetDef,
  type FacetsConfig,
  type FilterContext,
  type FilterState,
  type Product,
} from "./index.js";
import { loadCatalog, readData } from "./test-utils.js";

const cat = loadCatalog();
const facets = readData<FacetsConfig>("facets");
const ctx: FilterContext = {
  switches: readData<{ id: string; type: string }[]>("switches"),
  colors: readData<ColorsConfig>("colors"),
};
const inCat = (id: string): Product[] => cat.products.filter((p) => p.category === id);
const defs = (id: string): FacetDef[] => facets[id] as FacetDef[];
const names = (products: Product[], ps: FacetDef[], state: FilterState): string[] =>
  filterProducts(products, ps, state, ctx).map((i) => i.product.name);

describe("scenariusze S1-S4 (docs/12 par. 1) na danych z products.json", () => {
  it("S1: klawiatury, rozmiar 75% + lacznosc Bluetooth -> 1 produkt (Bazalt 75), adres ?rozmiar=75&lacznosc=bt", () => {
    const q = parseListingQuery({ rozmiar: "75", lacznosc: "bt" }, defs("klawiatury"));
    const r = queryListing({ products: inCat("klawiatury"), facets: defs("klawiatury"), query: q, ctx });
    expect(r.items.map((i) => i.product.name)).toEqual(["Bazalt 75"]);
    expect(r.countLabel).toBe("1 produkt");
    expect(serializeListingQuery(q, defs("klawiatury"))).toEqual({ rozmiar: "75", lacznosc: "bt" });
  });

  it("S2: klawiatury, cena 300-700 -> 5 produktow: Kwarc 60 (kolor z kolekcji 329 zl), Lupek 65, Kreda 98, Granit TKL, Marmur 100", () => {
    const q = parseListingQuery({ cena: "300-700" }, defs("klawiatury"));
    expect(q.filters["cena"]).toEqual({ min: 30000, max: 70000 });
    const r = queryListing({ products: inCat("klawiatury"), facets: defs("klawiatury"), query: q, ctx });
    expect(r.items.map((i) => i.product.name).sort()).toEqual(
      ["Granit TKL", "Kreda 98", "Kwarc 60", "Marmur 100", "Łupek 65"].sort(),
    );
    expect(r.countLabel).toBe("5 produktów");
  });

  it("S3: myszki, dlugosc dloni 19,5 -> 5 produktow, wszystkie poza Mewa", () => {
    const q = parseListingQuery({ dlon: "19,5" }, defs("myszki"));
    const r = queryListing({ products: inCat("myszki"), facets: defs("myszki"), query: q, ctx });
    expect(r.count).toBe(5);
    expect(r.items.map((i) => i.product.name)).not.toContain("Mewa");
    expect(r.countLabel).toBe("5 produktów");
  });

  it("S4: podkladki, na biurko -> 5 produktow (bez Lodu)", () => {
    const q = parseListingQuery({ typ: "biurko" }, defs("podkladki"));
    const r = queryListing({ products: inCat("podkladki"), facets: defs("podkladki"), query: q, ctx });
    expect(r.count).toBe(5);
    expect(r.items.map((i) => i.product.name)).not.toContain("Lód");
    // karta pokazuje pierwszy pasujacy wariant (biurkowy)
    for (const item of r.items) {
      expect(item.displayVariant?.size === "xl" || item.displayVariant?.size === "xxl").toBe(true);
    }
  });
});

describe("semantyka filtrow", () => {
  const kb = inCat("klawiatury");

  it("LUB w obrebie filtra, I miedzy filtrami", () => {
    expect(names(kb, defs("klawiatury"), { rozmiar: ["60", "65"] }).sort()).toEqual(["Kwarc 60", "Łupek 65"].sort());
    expect(names(kb, defs("klawiatury"), { rozmiar: ["60", "65"], lacznosc: ["bt"] })).toEqual(["Łupek 65"]);
  });

  it("filtr bool hotswap i przedzialy wagi (buckets, granice wlacznie)", () => {
    const hot = names(kb, defs("klawiatury"), { hotswap: true });
    expect(hot.length).toBe(kb.filter((p) => p.attributes["hotswap"] === true).length);
    const mice = inCat("myszki");
    expect(names(mice, defs("myszki"), { waga: ["do-60"] }).sort()).toEqual(["Jerzyk", "Mewa"].sort());
    expect(names(mice, defs("myszki"), { waga: ["60-80"] }).sort()).toEqual(["Pustułka", "Wróbel"].sort());
    expect(names(mice, defs("myszki"), { waga: ["od-80"] }).sort()).toEqual(["Czapla", "Kos"].sort());
    expect(names(mice, defs("myszki"), { waga: ["do-60", "od-80"] }).length).toBe(4);
  });

  it("filtr wariantowy: zostaje produkt z DOWOLNYM pasujacym wariantem, karta pokazuje pierwszy pasujacy", () => {
    const items = filterProducts(kb, defs("klawiatury"), { przelacznik: ["cichy"] }, ctx);
    expect(items.length).toBe(kb.length);
    for (const item of items) {
      expect(item.displayVariant?.switch).toBe("szept");
      expect(item.variants.every((v) => v.switch === "szept")).toBe(true);
    }
    const kolor = filterProducts(kb, defs("klawiatury"), { kolor: ["kobalt"] }, ctx);
    expect(kolor.map((i) => i.product.name).sort()).toEqual(["Bazalt 75", "Łupek 65"].sort());
    expect(kolor.every((i) => i.displayVariant?.color === "kobalt")).toBe(true);
  });

  it("filtry wariantowe dotycza TEGO SAMEGO wariantu (kobalt + cichy + dostepny wyklucza Bazalt)", () => {
    // K-BZL75-KOB-SZP jest bez stanu: osobno kazdy filtr by przepuscil Bazalt 75
    expect(cat.variant("K-BZL75-KOB-SZP").stock).toBe(0);
    const solo = (state: FilterState) => names(kb, defs("klawiatury"), state);
    expect(solo({ kolor: ["kobalt"] })).toContain("Bazalt 75");
    expect(solo({ przelacznik: ["cichy"] })).toContain("Bazalt 75");
    expect(solo({ dostepnosc: true })).toContain("Bazalt 75");
    expect(solo({ kolor: ["kobalt"], przelacznik: ["cichy"], dostepnosc: true })).not.toContain("Bazalt 75");
    expect(solo({ kolor: ["kobalt"], przelacznik: ["cichy"] })).toContain("Bazalt 75");
  });

  it("zakres ceny po wariantach, otwarte konce zakresu", () => {
    expect(names(kb, defs("klawiatury"), { cena: { min: null, max: 29900 } })).toEqual(["Kwarc 60"]);
    const min = cat.bySlug("bazalt-75").variants[0]?.price ?? 0;
    expect(names(kb, defs("klawiatury"), { cena: { min, max: null } })).toContain("Bazalt 75");
  });
});

describe("facety i liczniki (F-021)", () => {
  const kb = inCat("klawiatury");
  const find = (r: ReturnType<typeof computeFacets>, id: string) => {
    const f = r.find((x) => x.id === id);
    if (!f) throw new Error(`Brak facetu ${id}`);
    return f;
  };

  it("bez filtrow: licznik = liczba produktow z wartoscia (liczone niezaleznie z danych)", () => {
    const r = computeFacets(kb, defs("klawiatury"), {}, ctx);
    for (const v of find(r, "lacznosc").values) {
      const expected = kb.filter((p) => (p.attributes.connectivity ?? []).includes(v.v)).length;
      expect(v.count).toBe(expected);
    }
    for (const v of find(r, "rozmiar").values) expect(v.count).toBe(1);
  });

  it("liczniki uwzgledniaja pozostale filtry; zero = wartosc nieaktywna (chyba ze wybrana)", () => {
    const r = computeFacets(kb, defs("klawiatury"), { rozmiar: ["75"] }, ctx);
    const obudowa = find(r, "obudowa").values;
    expect(obudowa.find((v) => v.v === "aluminium")).toMatchObject({ count: 1, disabled: false });
    expect(obudowa.find((v) => v.v === "tworzywo")).toMatchObject({ count: 0, disabled: true });
    // liczniki tego samego facetu nie sa zawezane jego wlasnym wyborem (LUB)
    expect(find(r, "rozmiar").values.find((v) => v.v === "60")?.count).toBe(1);
    // wybrana wartosc z zerem zostaje aktywna, by dalo sie ja odznaczyc
    const r2 = computeFacets(kb, defs("klawiatury"), { rozmiar: ["75"], obudowa: ["tworzywo"] }, ctx);
    expect(find(r2, "obudowa").values.find((v) => v.v === "tworzywo")).toMatchObject({
      count: 0,
      selected: true,
      disabled: false,
    });
  });

  it("kolory dynamiczne z colors.json (etykieta i probka) oraz granice ceny", () => {
    const r = computeFacets(kb, defs("klawiatury"), {}, ctx);
    const kolor = find(r, "kolor").values;
    // Seria na poczatku (kolejnosc colors.json), potem kolory kolekcji (ADR-0011).
    expect(kolor.slice(0, 3).map((v) => v.v)).toEqual(["grafit", "mgla", "kobalt"]);
    expect(kolor.length).toBeGreaterThan(3);
    expect(kolor[2]).toMatchObject({ label: "Kobalt", swatch: ctx.colors["kobalt"]?.swatch });
    const prices = kb.flatMap((p) => p.variants.map((v) => v.price));
    expect(find(r, "cena").bounds).toEqual({ min: Math.min(...prices), max: Math.max(...prices) });
  });

  it("bool: licznik po wlaczeniu filtra", () => {
    const r = computeFacets(kb, defs("klawiatury"), {}, ctx);
    expect(find(r, "hotswap").count).toBe(kb.filter((p) => p.attributes["hotswap"] === true).length);
  });
});

describe("sortowanie (F-024) i cena listingu", () => {
  const items = (cid: string) => filterProducts(inCat(cid), defs(cid), {}, ctx);
  const order = (list: ReturnType<typeof items>) => list.map((i) => i.product.name);

  it("cena listingu = najnizsza cena dostepnego wariantu; bez stanu: najnizsza i available=false", () => {
    const lod = cat.bySlug("lod");
    const lp = listingPrice(lod.variants);
    expect(lp?.available).toBe(true);
    const allOut = lod.variants.map((v) => ({ ...v, stock: 0 }));
    expect(listingPrice(allOut)).toEqual({ price: Math.min(...lod.variants.map((v) => v.price)), available: false });
    expect(listingPrice([])).toBeNull();
  });

  it("cena rosnaco / malejaco po cenie najnizszego dostepnego wariantu", () => {
    const asc = sortListing(items("myszki"), "cena-rosnaco");
    const prices = asc.map((i) => listingPrice(i.variants)?.price ?? 0);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(order(asc)[0]).toBe("Wróbel");
    const desc = sortListing(items("myszki"), "cena-malejaco");
    const pd = desc.map((i) => listingPrice(i.variants)?.price ?? 0);
    expect(pd).toEqual([...pd].sort((a, b) => b - a));
  });

  it("nowosci: plakietka nowosc najpierw; najlzejsze: po wadze rosnaco (myszki)", () => {
    expect(order(sortListing(items("klawiatury"), "nowosci"))[0]).toBe("Bazalt 75");
    expect(order(sortListing(items("podkladki"), "nowosci"))[0]).toBe("Lód");
    const light = order(sortListing(items("myszki"), "najlzejsze"));
    expect(light[0]).toBe("Jerzyk");
    expect(light[light.length - 1]).toBe("Czapla");
  });

  it("polecane bez profilu: dostepne przed niedostepnymi, bestseller, suma fit, cena", () => {
    const base = items("klawiatury");
    const out = base.map((i) =>
      i.product.slug === "bazalt-75"
        ? { ...i, variants: i.variants.map((v) => ({ ...v, stock: 0 })) }
        : i,
    );
    const sorted = sortListing(out, "polecane");
    expect(order(sorted)[0]).toBe("Łupek 65"); // bestseller
    expect(order(sorted)[sorted.length - 1]).toBe("Bazalt 75"); // wszystkie warianty bez stanu
    const available = sortListing(base, "polecane");
    const sums = available.slice(1).map((i) => Object.values(i.product.fit).reduce((a, b) => a + b, 0));
    expect(sums).toEqual([...sums].sort((a, b) => b - a));
  });

  it("polecane z profilem (kreator): fit[profil] malejaco, potem cena rosnaco", () => {
    const sorted = sortListing(items("klawiatury"), "polecane", { profile: "fps" });
    const fits = sorted.map((i) => i.product.fit["fps"] ?? 0);
    expect(fits).toEqual([...fits].sort((a, b) => b - a));
    expect(order(sorted)[0]).toBe("Kwarc 60");
  });

  it("sortowanie jest stabilne i nie zmienia wejscia", () => {
    const base = items("podkladki");
    const copy = [...base];
    sortListing(base, "cena-rosnaco");
    expect(base).toEqual(copy);
  });
});

describe("adres i zetony (F-022, F-023)", () => {
  const kd = defs("klawiatury");

  it("parsowanie i serializacja: sort, strona, zakres w zlotych, wartosci spoza facetu odrzucone", () => {
    const q = parseListingQuery(
      { rozmiar: "75,tkl,xyz", lacznosc: "bt", cena: "300-700", hotswap: "1", sort: "cena-rosnaco", strona: "2" },
      kd,
    );
    expect(q.filters["rozmiar"]).toEqual(["75", "tkl"]);
    expect(q.sort).toBe("cena-rosnaco");
    expect(q.page).toBe(2);
    expect(serializeListingQuery(q, kd)).toEqual({
      rozmiar: "75,tkl",
      lacznosc: "bt",
      hotswap: "1",
      cena: "300-700",
      sort: "cena-rosnaco",
      strona: "2",
    });
  });

  it("wartosci domyslne i bledy: sort nieznany -> polecane, strona < 1 -> 1, zla cena pomijana", () => {
    const q = parseListingQuery({ sort: "losowo", strona: "0", cena: "abc", hotswap: "tak" }, kd);
    expect(q).toEqual({ filters: {}, sort: "polecane", page: 1 });
    expect(serializeListingQuery(q, kd)).toEqual({});
  });

  it("ceny z groszami w adresie przechodza bez bledow zmiennoprzecinkowych", () => {
    const q = parseListingQuery({ cena: "12,99-300.5" }, kd);
    expect(q.filters["cena"]).toEqual({ min: 1299, max: 30050 });
    expect(serializeListingQuery(q, kd)["cena"]).toBe("12.99-300.5");
  });

  it("zetony: etykiety, zdjecie jednego zetonu i wyczyszczenie", () => {
    const state: FilterState = { rozmiar: ["75", "tkl"], cena: { min: 30000, max: 70000 }, hotswap: true, kolor: ["kobalt"] };
    const chips = activeFilterChips(state, kd, ctx);
    expect(chips.map((c) => c.label)).toEqual([
      "Rozmiar: 75%",
      "Rozmiar: TKL",
      "Wymiana przełączników bez lutowania",
      "Kolor: Kobalt",
      "Cena: 300 zł–700 zł",
    ]);
    const after = removeChip(state, chips[0] as (typeof chips)[number]);
    expect(after["rozmiar"]).toEqual(["tkl"]);
    expect(state["rozmiar"]).toEqual(["75", "tkl"]);
    const gone = removeChip(after, chips[1] as (typeof chips)[number]);
    expect("rozmiar" in gone).toBe(false);
  });
});
