import { describe, expect, it } from "vitest";
import {
  configurationSku,
  configurationSurcharge,
  contrastRatio,
  defaultConfiguration,
  findModel,
  parseConfigurationSku,
  resolveConfiguration,
  type ConfData,
  type Configuration,
} from "./index.js";
import { readData } from "./test-utils.js";

const parts = readData<{ palettes: ConfData["palettes"]; models: ConfData["models"] }>("parts");
const data: ConfData = {
  colors: readData("colors"),
  finishes: readData("finishes"),
  palettes: parts.palettes,
  models: parts.models,
  prints: readData("prints"),
  surcharges: readData("surcharges"),
};

function cfg(
  model: string,
  patch: Configuration["parts"] = {},
  print: string | null = null,
): Configuration {
  // Tylko wybory uzytkownika: reszte (i czesci zalezne) uzupelnia resolveConfiguration.
  return { model, parts: patch, print };
}

describe("dane konfiguratora (ADR-0011)", () => {
  it("26 modeli, 150 kolorow (49 palety + 101 kolekcji), kody kolorow i wykonczen sa unikalne", () => {
    expect(data.models).toHaveLength(26);
    const codes = Object.values(data.colors).map((c) => c.code);
    expect(codes).toHaveLength(150);
    expect(new Set(codes).size).toBe(150);
    expect(codes).not.toContain("AUT");
    const fin = Object.values(data.finishes).map((f) => f.code);
    expect(new Set(fin).size).toBe(fin.length);
  });

  it("nowy kolor Bazaltu: antracyt bez doplaty, inny anodowany +40 zl", () => {
    const s = (color: string) =>
      configurationSurcharge(
        data,
        resolveConfiguration(data, cfg("k-bazalt-75", { obudowa: { color, finish: "anodowane" } }))
          .config,
      );
    expect(s("antracyt")).toBe(0);
    expect(s("stal")).toBe(4000);
  });

  it("pierwsze cztery kolory to dotychczasowa seria", () => {
    expect(Object.keys(data.colors).slice(0, 4)).toEqual(["grafit", "mgla", "kobalt", "naturalny"]);
    expect(data.colors.grafit!.code).toBe("GRF");
  });

  it("kazda paleta czesci wskazuje istniejace kolory i wykonczenia", () => {
    for (const [id, p] of Object.entries(data.palettes)) {
      if (typeof p.kolory === "string")
        expect(data.palettes[p.kolory.replace(/^jak /, "")], id).toBeDefined();
      else for (const c of p.kolory) expect(data.colors[c], `${id}:${c}`).toBeDefined();
      for (const f of p.wykonczenia) expect(data.finishes[f], `${id}:${f}`).toBeDefined();
    }
    for (const m of data.models)
      for (const part of m.parts)
        if (part.paleta) expect(data.palettes[part.paleta], `${m.id}:${part.id}`).toBeDefined();
  });

  it("domyslna konfiguracja kazdego modelu jest poprawna, ma zero doplaty i odtwarzalne SKU", () => {
    for (const m of data.models) {
      const c = defaultConfiguration(m);
      const r = resolveConfiguration(data, c);
      expect(r.issues, m.id).toEqual([]);
      expect(configurationSurcharge(data, r.config), m.id).toBe(0);
      const sku = configurationSku(data, r.config);
      expect(sku.startsWith(`${m.sku_prefix}-CFG-`)).toBe(true);
      expect(parseConfigurationSku(data, sku), m.id).toEqual(r.config);
    }
  });
});

describe("kontrast nadrukow", () => {
  it("liczy WCAG", () => {
    expect(contrastRatio(data.colors.czern!.swatch, data.colors.biel!.swatch)).toBeGreaterThan(15);
    expect(contrastRatio(data.colors.mgla!.swatch, data.colors.mgla!.swatch)).toBe(1);
  });

  it("nadruk o slabym kontrascie jest zamieniany na biel lub czern i raportowany", () => {
    const r = resolveConfiguration(
      data,
      cfg("k-kwarc-60", {
        klawisze_alfa: { color: "mgla", finish: "abs" },
        legendy_alfa: { color: "mgla", finish: null },
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.config.parts.legendy_alfa!.color).toBe("czern");
    expect(r.adjustments).toEqual([
      { part: "legendy_alfa", from: "mgla", to: "czern", reason: "contrast" },
    ]);
  });

  it("auto wybiera lepszy kontrast bez raportu zmiany", () => {
    const r = resolveConfiguration(
      data,
      cfg("k-kwarc-60", {
        klawisze_mod: { color: "grafit", finish: "abs" },
        legendy_mod: { color: "auto", finish: null },
      }),
    );
    expect(r.config.parts.legendy_mod!.color).toBe("biel");
    expect(r.adjustments).toEqual([]);
  });

  it("wystarczajacy kontrast zostaje bez zmian", () => {
    const r = resolveConfiguration(
      data,
      cfg("k-kwarc-60", {
        klawisze_alfa: { color: "grafit", finish: "abs" },
        legendy_alfa: { color: "biel", finish: null },
      }),
    );
    expect(r.config.parts.legendy_alfa!.color).toBe("biel");
    expect(r.adjustments).toEqual([]);
  });
});

describe("ograniczenia techniczne", () => {
  it("czerwony Esc na kobaltowej obudowie jest dozwolony", () => {
    const r = resolveConfiguration(
      data,
      cfg("k-kwarc-60", {
        obudowa: { color: "kobalt", finish: "mat" },
        klawisze_akcent: { color: "czerwien", finish: "abs" },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("anodowanie tylko w modelach aluminiowych", () => {
    expect(
      resolveConfiguration(
        data,
        cfg("k-kwarc-60", { obudowa: { color: "grafit", finish: "anodowane" } }),
      ).issues[0]?.code,
    ).toBe("finish_not_allowed");
    expect(
      resolveConfiguration(
        data,
        cfg("k-bazalt-75", { obudowa: { color: "stal", finish: "anodowane" } }),
      ).ok,
    ).toBe(true);
  });

  it("polprzezroczysta obudowa wymaga podswietlenia (Granit TKL go nie ma)", () => {
    const granitPart = findModel(data, "k-granit-tkl")!.parts.some((p) => p.id === "podswietlenie");
    expect(granitPart).toBe(false);
    const r = resolveConfiguration(
      data,
      cfg("k-granit-tkl", { obudowa: { color: "grafit", finish: "polprzezroczyste" } }),
    );
    expect(r.ok).toBe(false);
    expect(
      resolveConfiguration(
        data,
        cfg("k-kwarc-60", { obudowa: { color: "grafit", finish: "polprzezroczyste" } }),
      ).ok,
    ).toBe(true);
  });

  it("pokretlo tylko w Bazalcie", () => {
    const r = resolveConfiguration(
      data,
      cfg("k-kwarc-60", { pokretlo: { color: "grafit", finish: "anodowane" } }),
    );
    expect(r.issues[0]?.code).toBe("unknown_part");
    expect(resolveConfiguration(data, cfg("k-bazalt-75")).config.parts.pokretlo).toBeDefined();
  });

  it("odrzuca kolor spoza palety, nieznany model i nadruk spoza rodziny", () => {
    expect(
      resolveConfiguration(data, cfg("k-kwarc-60", { obudowa: { color: "nie-ma", finish: "mat" } }))
        .issues[0]?.code,
    ).toBe("unknown_color");
    expect(resolveConfiguration(data, { model: "x", parts: {} }).issues[0]?.code).toBe(
      "unknown_model",
    );
    const forTafla = data.prints.find((p) => p.dla.includes("p-tafla"))!;
    const notForFilc = resolveConfiguration(data, cfg("p-filc_xl", {}, forTafla.id));
    expect(notForFilc.issues[0]?.code).toBe("print_not_for_model");
  });
});

describe("doplaty w groszach", () => {
  it("seria bez doplaty, kolor spoza serii w macie +30 zl", () => {
    expect(
      configurationSurcharge(
        data,
        resolveConfiguration(
          data,
          cfg("k-kwarc-60", { obudowa: { color: "kobalt", finish: "mat" } }),
        ).config,
      ),
    ).toBe(0);
    expect(
      configurationSurcharge(
        data,
        resolveConfiguration(
          data,
          cfg("k-kwarc-60", { obudowa: { color: "turkus", finish: "mat" } }),
        ).config,
      ),
    ).toBe(3000);
  });

  it("wykonczenia: polysk 40, opal 60, polprzezroczyste 50", () => {
    const s = (finish: string) =>
      configurationSurcharge(
        data,
        resolveConfiguration(data, cfg("k-kwarc-60", { obudowa: { color: "grafit", finish } }))
          .config,
      );
    expect(s("polysk")).toBe(4000);
    expect(s("opal")).toBe(6000);
    expect(s("polprzezroczyste")).toBe(5000);
  });

  it("obudowa dwukolorowa +20, klawisze jelly +20 raz, pokretlo +10", () => {
    const k = configurationSurcharge(
      data,
      resolveConfiguration(
        data,
        cfg("k-bazalt-75", {
          obudowa_spod: { color: "czern", finish: "anodowane" },
          klawisze_alfa: { color: "mgla", finish: "jelly" },
          klawisze_mod: { color: "grafit", finish: "jelly" },
          pokretlo: { color: data.palettes["kb.pokretlo"]!.kolory[1]!, finish: "anodowane" },
        }),
      ).config,
    );
    expect(k).toBe((20 + 20 + 10) * 100);
  });

  it("myszka: kolor spoza serii +20, przyciski w innym kolorze +20", () => {
    const c = resolveConfiguration(
      data,
      cfg("m-kos", {
        korpus: { color: "turkus", finish: "mat" },
        przyciski: { color: "grafit", finish: "mat" },
      }),
    ).config;
    expect(configurationSurcharge(data, c)).toBe(4000);
  });

  it("podkladka: nadruk +10 zl", () => {
    const print = data.prints.find((p) => p.dla.includes("p-tafla"))!.id;
    const r = resolveConfiguration(data, cfg("p-tafla_m", {}, print));
    expect(r.ok).toBe(true);
    expect(configurationSurcharge(data, r.config)).toBe(1000);
  });
});

describe("SKU konfiguracji", () => {
  it("jest deterministyczne i odwracalne", () => {
    const r = resolveConfiguration(
      data,
      cfg("k-kwarc-60", {
        obudowa: { color: "turkus", finish: "polysk" },
        klawisze_alfa: { color: "krem", finish: "pbt" },
        legendy_alfa: { color: "auto", finish: null },
      }),
    );
    const sku = configurationSku(data, r.config);
    expect(sku).toMatch(/^K-KWR60-CFG-TRK[A-Z]\./);
    expect(sku).not.toContain("AUTO");
    expect(configurationSku(data, r.config)).toBe(sku);
    const back = parseConfigurationSku(data, sku)!;
    expect(resolveConfiguration(data, back).config).toEqual(r.config);
  });

  it("kodowanie nadruku podkladki", () => {
    const print = data.prints.find((p) => p.dla.includes("p-tafla"))!.id;
    const r = resolveConfiguration(data, cfg("p-tafla_l", {}, print));
    const sku = configurationSku(data, r.config);
    expect(sku.startsWith("P-TFL-L-CFG-N")).toBe(true);
    expect(parseConfigurationSku(data, sku)?.print).toBe(print);
  });

  it("odrzuca SKU, ktorego nie da sie odtworzyc", () => {
    expect(parseConfigurationSku(data, "K-KWR60-GRF-SLZ")).toBeNull();
    expect(parseConfigurationSku(data, "K-KWR60-CFG-XXXM.YYYM")).toBeNull();
    expect(parseConfigurationSku(data, "Z-NIE-CFG-GRFM")).toBeNull();
  });
});
