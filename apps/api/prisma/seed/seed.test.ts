// B-102: testy jednostkowe seeda (bez bazy): walidacja danych zrodlowych, historia cen, parser stron.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGuide, parsePage } from "./content.js";
import { buildPriceHistory } from "./history.js";
import { loadSeedData, SeedValidationError } from "./load.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

describe("B-102 loadSeedData (data/*.json)", () => {
  const d = loadSeedData(root);

  it("liczby kontrolne z docs/17 par. 6", () => {
    expect(d.categories).toHaveLength(3);
    expect(d.products).toHaveLength(18);
    expect(d.variants).toHaveLength(329);
    expect(d.switches).toHaveLength(4);
    expect(d.colors).toHaveLength(150);
    expect(d.presets).toHaveLength(4);
    expect(d.shop.shipping_methods).toHaveLength(3);
    expect(d.shop.payment_methods).toHaveLength(4);
    expect(d.shop.codes).toHaveLength(2);
    expect(d.shop.pickup_points).toHaveLength(6);
    expect(d.manifest).toHaveLength(300);
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
    expect(d.pages).toHaveLength(8);
    expect(d.pages.every((p) => p.demoNotice && p.bodyMd.length > 100)).toBe(true);
  });

  it("F-220: 4 poradniki z profilem kreatora z rules.json i wejsciem do kreatora na koncu", () => {
    expect(d.guides.map((g) => g.slug).sort()).toEqual([
      "jak-dobrac-mysz-do-dloni",
      "jak-wybrac-przelaczniki",
      "jaka-podkladka",
      "rozmiary-klawiatur",
    ]);
    for (const g of d.guides) {
      expect(Object.keys(d.rules.profiles)).toContain(g.profile);
      expect(g.demoNotice).toBe(true);
      const words = g.bodyMd.split(/\s+/).filter(Boolean).length;
      expect(words).toBeGreaterThanOrEqual(600);
      expect(words).toBeLessThanOrEqual(900);
      expect(g.bodyMd.trimEnd().split("\n").at(-1)).toContain(`](/zbuduj-set?profil=${g.profile})`);
    }
  });

  it("F-076: 3-6 opinii na kazdy z 18 produktow, oceny 3-5, daty z 6 miesiecy do chwili seeda", () => {
    const byProduct = new Map<string, number>();
    for (const r of d.reviews) byProduct.set(r.productId, (byProduct.get(r.productId) ?? 0) + 1);
    expect(byProduct.size).toBe(18);
    for (const n of byProduct.values()) {
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
    const now = new Date("2026-10-07T10:00:00Z");
    const earliest = new Date("2026-04-07T00:00:00Z");
    for (const r of d.reviews) {
      expect(r.rating).toBeGreaterThanOrEqual(3);
      expect(r.rating).toBeLessThanOrEqual(5);
      expect(r.date.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(r.date.getTime()).toBeGreaterThanOrEqual(earliest.getTime());
      expect(r.id).toMatch(/^rv-[a-z0-9-]+-\d$/);
    }
    expect(new Set(d.reviews.map((r) => r.rating)).size).toBeGreaterThan(1);
  });

  it("F-221: FAQ ma co najmniej 8 pytan z unikalnymi identyfikatorami", () => {
    expect(d.faq.length).toBeGreaterThanOrEqual(8);
    expect(new Set(d.faq.map((q) => q.id)).size).toBe(d.faq.length);
    expect(d.faq.map((q) => q.position)).toEqual(d.faq.map((_, i) => i + 1));
  });

  it("zawiera bledy z nazwa pliku i pola", () => {
    expect(() => loadSeedData(fileURLToPath(new URL("../", import.meta.url)))).toThrow();
    expect(SeedValidationError.name).toBe("SeedValidationError");
  });
});

describe("F-220, F-221, F-076: bledy tresci (kopia danych w katalogu tymczasowym)", () => {
  /** Kopiuje data/, content/ i manifest do katalogu tymczasowego, stosuje zmiane i wczytuje dane. */
  const load = (mutate: (dir: string) => void, now?: Date): void => {
    const dir = mkdtempSync(join(tmpdir(), "taktyl-seed-"));
    try {
      for (const rel of ["data", "content"]) {
        cpSync(join(root, rel), join(dir, rel), { recursive: true });
      }
      cpSync(join(root, "assets"), join(dir, "assets"), { recursive: true });
      mutate(dir);
      loadSeedData(dir, now);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const edit = (dir: string, rel: string, fn: (s: string) => string): void => {
    writeFileSync(join(dir, rel), fn(readFileSync(join(dir, rel), "utf8")));
  };

  it("kopia bez zmian jest poprawna", () => {
    expect(() => load(() => undefined)).not.toThrow();
  });

  it("opinia z nieistniejacym wariantem", () => {
    expect(() =>
      load((dir) =>
        edit(dir, "data/reviews.json", (s) => s.replace("Grafit · Ślizg", "Zielony · Ślizg")),
      ),
    ).toThrow(/wariant/);
  });

  it("opinia z ocena poza 3-5", () => {
    expect(() =>
      load((dir) => edit(dir, "data/reviews.json", (s) => s.replace('"rating": 3', '"rating": 2'))),
    ).toThrow(/reviews\.json/);
  });

  it("opinia z data z przyszlosci wzgledem chwili seeda", () => {
    expect(() => load(() => undefined, new Date("2026-06-01T00:00:00Z"))).toThrow(/z przyszlosci/);
  });

  it("poradnik z profilem spoza rules.json", () => {
    expect(() =>
      load((dir) =>
        edit(dir, "content/guides/jaka-podkladka.md", (s) =>
          s.replace("profile: biuro", "profile: nieznany"),
        ),
      ),
    ).toThrow(/profil/);
  });

  it("FAQ ze zdublowanym kluczem", () => {
    expect(() =>
      load((dir) =>
        edit(dir, "content/faq.json", (s) => s.replace('"key": "platnosc"', '"key": "demo"')),
      ),
    ).toThrow(/zdublowany klucz/);
  });
});

describe("F-220 parseGuide", () => {
  const src =
    "---\nslug: test-poradnik\ntitle: Test: poradnik\nupdated: 2026-10-07\nlead: Dwadziescia znakow co najmniej.\nprofile: fps\nreading_minutes: 4\ndemo: true\n---\n\nTresc\n";

  it("czyta frontmatter poradnika, tytul moze miec dwukropek", () => {
    expect(parseGuide(src, "x.md")).toEqual({
      slug: "test-poradnik",
      title: "Test: poradnik",
      updated: "2026-10-07",
      lead: "Dwadziescia znakow co najmniej.",
      profile: "fps",
      readingMinutes: 4,
      demoNotice: true,
      bodyMd: "Tresc",
    });
  });

  it("odrzuca brak pola, demo: false i nieznane pole", () => {
    expect(() => parseGuide(src.replace("profile: fps\n", ""), "x.md")).toThrow(/profile/);
    expect(() => parseGuide(src.replace("demo: true", "demo: false"), "x.md")).toThrow(/demo/);
    expect(() => parseGuide(src.replace("demo: true", "demo: true\nextra: 1"), "x.md")).toThrow(
      /frontmatter/,
    );
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
