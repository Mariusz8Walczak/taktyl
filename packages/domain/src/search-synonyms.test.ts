// F-006 (TAKTYL-59): synonimy wyszukiwarki na prawdziwych danych z data/products.json.
import { describe, expect, it } from "vitest";
import { loadCatalog } from "./test-utils.js";
import { isQuietProduct, matchesProductSearch } from "./search.js";

const { products } = loadCatalog();

/** Tekst indeksu uproszczony do nazwy, opisu i rozmiaru (jak w API, bez przelacznikow i kolorow). */
const text = (p: (typeof products)[number]) =>
  `${p.name} ${p.short} ${String(p.attributes.size ?? "")} ${String(p.attributes.size_label ?? "")}`;
const find = (q: string) =>
  products.filter((p) => matchesProductSearch(p, text(p), q)).map((p) => p.slug);

describe("synonimy F-006", () => {
  it("'cicha' zwraca tylko produkty z profilem cisza >= 2", () => {
    const expected = products.filter((p) => (p.fit.cisza ?? 0) >= 2).map((p) => p.slug);
    const got = find("cicha");
    expect(got).toEqual(expect.arrayContaining(expected));
    for (const slug of got) {
      const p = products.find((x) => x.slug === slug)!;
      const viaSynonym = (p.fit.cisza ?? 0) >= 2;
      const viaText = matchesProductSearch({ ...p, fit: {} }, text(p), "cicha");
      expect(viaSynonym || viaText).toBe(true);
    }
    expect(got).not.toContain("kwarc-60"); // cisza 1
    expect(got).toContain("kreda-98"); // cisza 3
  });

  it("isQuietProduct (zeton Ciche w kreatorze) zaweza klawiatury (TAKTYL-67)", () => {
    const kb = products.filter((p) => p.category === "klawiatury");
    const quiet = kb.filter(isQuietProduct).map((p) => p.slug);
    expect(quiet.length).toBeGreaterThan(0);
    expect(quiet.length).toBeLessThan(kb.length);
    expect(quiet).toContain("kreda-98");
    expect(quiet).not.toContain("kwarc-60");
  });

  it("'tkl' znajduje klawiature TKL (rozmiar z atrybutow)", () => {
    const got = find("tkl");
    expect(got).toContain("granit-tkl");
    expect(got).not.toContain("kwarc-60");
    for (const slug of got) {
      const p = products.find((x) => x.slug === slug)!;
      expect(text(p).toLowerCase()).toContain("tkl");
    }
  });

  it("'bezprzewodowa' wymaga Bluetooth lub 2,4 GHz", () => {
    const got = find("bezprzewodowa");
    expect(got).toContain("lupek-65");
    expect(got).not.toContain("kwarc-60"); // tylko USB-C
    expect(got).not.toContain("wrobel"); // przewodowa
  });

  it("'lekka' to mysz do 60 g, 'pionowa' to ksztalt pionowy, 'mata' to podkladki", () => {
    expect(find("lekka").sort()).toEqual(["jerzyk", "mewa"].sort());
    expect(find("pionowa")).toEqual(["czapla"]);
    expect(find("mata").sort()).toEqual(
      products
        .filter((p) => p.category === "podkladki")
        .map((p) => p.slug)
        .sort(),
    );
  });

  it("slowa laczone: 'cicha mata' i puste zapytanie", () => {
    const got = find("cicha mata");
    for (const slug of got) {
      const p = products.find((x) => x.slug === slug)!;
      expect(p.category).toBe("podkladki");
      expect(p.fit.cisza ?? 0).toBeGreaterThanOrEqual(2);
    }
    expect(got).toContain("korek");
    expect(find("   ")).toEqual([]);
  });
});
