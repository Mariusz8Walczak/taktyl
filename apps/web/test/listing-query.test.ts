// F-021, F-022, F-023, F-025 (TAKTYL-27): stan listingu <-> adres <-> zapytanie do API, zeton i licznik.
import type { FacetsResponse } from "@taktyl/contracts";
import { activeFilterChips, formatCount, PRODUCT_FORMS, removeChip } from "@taktyl/domain";
import { describe, expect, it } from "vitest";
import { setBool, setNumber, setRange, toggleValue } from "../src/lib/catalog/filter-actions";
import {
  activeFilterCount,
  facetDefs,
  parseQuery,
  sortOptionsFor,
  toApiFilters,
  toSearch,
} from "../src/lib/catalog/listing-query";

type Facet = FacetsResponse["facets"][number];

const FACETS: Facet[] = [
  {
    id: "rozmiar",
    label: "Rozmiar",
    type: "multi",
    values: [
      { v: "60", label: "60%", count: 1, disabled: false },
      { v: "75", label: "75%", count: 1, disabled: false },
      { v: "tkl", label: "TKL", count: 1, disabled: false },
    ],
  },
  {
    id: "lacznosc",
    label: "Łączność",
    type: "multi",
    values: [
      { v: "usb-c", label: "Przewód USB-C", count: 6, disabled: false },
      { v: "2.4ghz", label: "2,4 GHz", count: 4, disabled: false },
      { v: "bt", label: "Bluetooth", count: 3, disabled: false },
    ],
  },
  {
    id: "hotswap",
    label: "Wymiana przełączników bez lutowania",
    type: "bool",
    count: 4,
    disabled: false,
  },
  { id: "cena", label: "Cena", type: "range", min_gr: 29900, max_gr: 74900 },
  { id: "dlon", label: "Długość dłoni (cm)", type: "number-match", min_cm: 16, max_cm: 21 },
];
const DEFS = facetDefs(FACETS);

describe("adres <-> filtry (F-022)", () => {
  it("odtwarza S1 z adresu: ?rozmiar=75&lacznosc=bt", () => {
    const q = parseQuery({ rozmiar: "75", lacznosc: "bt" }, DEFS, "klawiatury");
    expect(q.filters).toEqual({ rozmiar: ["75"], lacznosc: ["bt"] });
    expect(q.sort).toBe("polecane");
    expect(toSearch(q, DEFS)).toBe("?rozmiar=75&lacznosc=bt");
  });

  it("listy wartosci po przecinku, kolejnosc facetow z API, domyslne sortowanie pomijane", () => {
    const q = parseQuery(
      { lacznosc: "bt", rozmiar: "75,tkl", sort: "cena-rosnaco", strona: "2" },
      DEFS,
      "klawiatury",
    );
    expect(toSearch(q, DEFS)).toBe("?rozmiar=75,tkl&lacznosc=bt&sort=cena-rosnaco&strona=2");
    expect(q.page).toBe(2);
  });

  it("nieznane wartosci i zle liczby sa pomijane", () => {
    const q = parseQuery(
      { rozmiar: "999", dlon: "abc", cena: "x-y", hotswap: "0" },
      DEFS,
      "klawiatury",
    );
    expect(q.filters).toEqual({});
    expect(toSearch(q, DEFS)).toBe("");
  });

  it("'najlzejsze' tylko dla myszek", () => {
    expect(parseQuery({ sort: "najlzejsze" }, DEFS, "klawiatury").sort).toBe("polecane");
    expect(parseQuery({ sort: "najlzejsze" }, DEFS, "myszki").sort).toBe("najlzejsze");
    expect(sortOptionsFor("podkladki").map((o) => o.value)).not.toContain("najlzejsze");
    expect(sortOptionsFor("myszki").map((o) => o.value)).toContain("najlzejsze");
  });
});

describe("zadanie do API (cena w groszach, docs/16 §1)", () => {
  it("S2: cena 300-700 zl -> 30000-70000 gr", () => {
    const q = parseQuery({ cena: "300-700" }, DEFS, "klawiatury");
    expect(toApiFilters(q.filters, FACETS)).toEqual({ cena: "30000-70000" });
  });

  it("zakres otwarty z jednej strony bierze granice katalogu", () => {
    const q = parseQuery({ cena: "300-" }, DEFS, "klawiatury");
    expect(toApiFilters(q.filters, FACETS)).toEqual({ cena: "30000-74900" });
  });

  it("S3: dlon 19,5 -> 19.5; wartosc spoza formatu API jest pomijana", () => {
    expect(toApiFilters(parseQuery({ dlon: "19,5" }, DEFS, "myszki").filters, FACETS)).toEqual({
      dlon: "19.5",
    });
    expect(toApiFilters(parseQuery({ dlon: "5" }, DEFS, "myszki").filters, FACETS)).toEqual({});
  });

  it("wartosc w ksztalcie spoza kontraktu API (np. rozmiar myszki S) nie psuje zadania", () => {
    const facets: Facet[] = [
      {
        id: "rozmiar",
        label: "Rozmiar",
        type: "multi",
        values: [
          { v: "S", label: "S", count: 1, disabled: false },
          { v: "m", label: "M", count: 1, disabled: false },
        ],
      },
    ];
    const q = parseQuery({ rozmiar: "S,m" }, facetDefs(facets), "myszki");
    expect(q.filters).toEqual({ rozmiar: ["S", "m"] });
    expect(toApiFilters(q.filters, facets)).toEqual({ rozmiar: "m" });
  });

  it("bool i listy", () => {
    const q = parseQuery({ hotswap: "1", rozmiar: "75,tkl" }, DEFS, "klawiatury");
    expect(toApiFilters(q.filters, FACETS)).toEqual({ rozmiar: "75,tkl", hotswap: "1" });
  });
});

describe("zmiany filtrow i zetony (F-023)", () => {
  it("toggleValue dodaje i zdejmuje, pusta lista usuwa filtr", () => {
    let s = toggleValue({}, "rozmiar", "75");
    s = toggleValue(s, "rozmiar", "tkl");
    expect(s).toEqual({ rozmiar: ["75", "tkl"] });
    s = toggleValue(s, "rozmiar", "75");
    expect(s).toEqual({ rozmiar: ["tkl"] });
    expect(toggleValue(s, "rozmiar", "tkl")).toEqual({});
  });

  it("setRange z granicami katalogu zdejmuje filtr; zawezony zostaje", () => {
    const bounds = { min: 29900, max: 74900 };
    expect(setRange({}, "cena", 29900, 74900, bounds)).toEqual({});
    expect(setRange({}, "cena", 30000, 70000, bounds)).toEqual({
      cena: { min: 30000, max: 70000 },
    });
    expect(setRange({}, "cena", 30000, 74900, bounds)).toEqual({ cena: { min: 30000, max: null } });
  });

  it("setBool i setNumber", () => {
    expect(setBool({}, "hotswap", true)).toEqual({ hotswap: true });
    expect(setBool({ hotswap: true }, "hotswap", false)).toEqual({});
    expect(setNumber({}, "dlon", 19.5)).toEqual({ dlon: 19.5 });
    expect(setNumber({ dlon: 19.5 }, "dlon", null)).toEqual({});
  });

  it("zetony: etykiety z definicji, usuniecie zetonu zdejmuje filtr", () => {
    const state = parseQuery(
      { rozmiar: "75,tkl", lacznosc: "bt", cena: "300-700" },
      DEFS,
      "klawiatury",
    ).filters;
    const chips = activeFilterChips(state, DEFS, { switches: [], colors: {} });
    expect(chips.map((c) => c.label)).toEqual([
      "Rozmiar: 75%",
      "Rozmiar: TKL",
      "Łączność: Bluetooth",
      expect.stringMatching(/^Cena: 300\u00A0zł–700\u00A0zł$/),
    ]);
    expect(activeFilterCount(state)).toBe(4);
    const next = removeChip(state, chips[0]!);
    expect(next.rozmiar).toEqual(["tkl"]);
    expect(removeChip(next, chips[3]!).cena).toBeUndefined();
  });
});

describe("licznik wynikow (F-025, Intl.PluralRules)", () => {
  it("odmiana", () => {
    expect(formatCount(0, PRODUCT_FORMS)).toBe("0 produktów");
    expect(formatCount(1, PRODUCT_FORMS)).toBe("1 produkt");
    expect(formatCount(4, PRODUCT_FORMS)).toBe("4 produkty");
    expect(formatCount(5, PRODUCT_FORMS)).toBe("5 produktów");
    expect(formatCount(12, PRODUCT_FORMS)).toBe("12 produktów");
    expect(formatCount(22, PRODUCT_FORMS)).toBe("22 produkty");
  });
});
