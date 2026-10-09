// F-250, F-251 (ADR-0011): czysta logika widoku konfiguratora na prawdziwych danych z data/*.json.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConfiguratorData } from "@taktyl/contracts";
import { defaultConfiguration, resolveConfiguration } from "@taktyl/domain";
import { describe, expect, it } from "vitest";
import {
  applyChoice,
  explicitChoices,
  placeOnDesk,
  allowedFinishes,
  configurableParts,
  findModelById,
  modelIdFor,
  paletteColors,
  partPaint,
  printMapping,
  printsForModel,
  supportsPrints,
  toDomainData,
} from "../src/lib/configurator/model";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data");
const read = <T>(n: string): T => JSON.parse(readFileSync(join(root, `${n}.json`), "utf8")) as T;
const parts = read<{ palettes: ConfiguratorData["palettes"]; models: ConfiguratorData["models"] }>(
  "parts",
);
const data: ConfiguratorData = {
  colors: read("colors"),
  finishes: read("finishes"),
  palettes: parts.palettes,
  models: parts.models,
  prints: read("prints"),
};

describe("model konfiguratora", () => {
  it("modelIdFor: podkladki z rozmiarem, reszta po id produktu", () => {
    expect(modelIdFor("k-kwarc-60", null)).toBe("k-kwarc-60");
    expect(modelIdFor("m-kos", null)).toBe("m-kos");
    expect(modelIdFor("p-tafla", "xl")).toBe("p-tafla_xl");
  });

  it("paleta z odwolaniem 'jak ms.korpus' rozwija sie do kolorow korpusu", () => {
    expect(paletteColors(data, "ms.przyciski")).toEqual(paletteColors(data, "ms.korpus"));
    expect(paletteColors(data, "ms.przyciski").length).toBeGreaterThan(10);
  });

  it("polprzezroczyste wykonczenia tylko dla modeli z podswietleniem", () => {
    const kwarc = findModelById(data, "k-kwarc-60")!;
    const granit = findModelById(data, "k-granit-tkl")!;
    const obudowa = (m: typeof kwarc) => m.parts.find((p) => p.id === "obudowa")!;
    expect(allowedFinishes(data, kwarc, obudowa(kwarc))).toContain("polprzezroczyste");
    expect(allowedFinishes(data, granit, obudowa(granit))).not.toContain("polprzezroczyste");
  });

  it("partPaint: kolor z probki, PBR z wykonczenia, podswietlenie jako emisja", () => {
    const model = findModelById(data, "k-kwarc-60")!;
    const cfg = resolveConfiguration(
      toDomainData(data),
      defaultConfiguration(model as never),
    ).config;
    const body = partPaint(data, cfg, "obudowa")!;
    expect(body.color).toBe(data.colors[cfg.parts.obudowa!.color]!.swatch);
    expect(body.emissive).toBe(false);
    expect(partPaint(data, cfg, "podswietlenie")!.emissive).toBe(true);
    expect(partPaint(data, cfg, "nie-ma")).toBeNull();
  });

  it("printMapping: tryb skala przycina do podkladki, inny rozciaga na calosc", () => {
    const skala = data.prints.find((p) => p.tryb === "skala" && p.mm)!;
    const m = printMapping(skala, [(skala.mm![0] ?? 0) / 2, skala.mm![1] ?? 0]);
    expect(m.repeat[0]).toBeCloseTo(0.5);
    expect(m.repeat[1]).toBeCloseTo(1);
    expect(m.offset[0]).toBeCloseTo(0.25);
    const rozciagnij = data.prints.find((p) => p.tryb !== "skala");
    if (rozciagnij)
      expect(printMapping(rozciagnij, [100, 100])).toEqual({ repeat: [1, 1], offset: [0, 0] });
  });

  it("nadruki dla Tafli tak, dla Filcu nie; klawiatury nie maja wyboru nadruku", () => {
    const tafla = findModelById(data, "p-tafla_m")!;
    expect(supportsPrints(data, tafla)).toBe(true);
    expect(printsForModel(data, tafla).length).toBeGreaterThan(5);
    expect(supportsPrints(data, findModelById(data, "p-filc_xl")!)).toBe(false);
    expect(supportsPrints(data, findModelById(data, "k-kwarc-60")!)).toBe(false);
  });

  it("czesci do wyboru: tylko konfigurowalne z paleta", () => {
    const ids = configurableParts(findModelById(data, "k-bazalt-75")!).map((p) => p.id);
    expect(ids).toContain("pokretlo");
    expect(ids).not.toContain("plyta");
  });

  it("placeOnDesk: elementy stoja na grubosci podkladki, mysz obok klawiatury, klawiatura przy krawedzi uzytkownika", () => {
    const pad = findModelById(data, "p-tafla_l")!;
    const kb = findModelById(data, "k-kwarc-60")!;
    const mouse = findModelById(data, "m-kos")!;
    const p = placeOnDesk(pad.dims_mm, kb.dims_mm, mouse.dims_mm);
    expect(p.pad).toEqual([0, 0, 0]);
    expect(p.keyboard[1]).toBeCloseTo((pad.dims_mm[2] ?? 0) / 1000);
    expect(p.mouse[0]).toBeGreaterThan(p.keyboard[0]);
    expect(p.keyboard[2]).toBeGreaterThan(0);
    expect((p.mouse[0] - p.keyboard[0]) * 1000).toBeGreaterThanOrEqual(
      ((kb.dims_mm[0] ?? 0) + (mouse.dims_mm[0] ?? 0)) / 2,
    );
  });

  it("explicitChoices zostawia tylko wybory inne niz domyslne", () => {
    const model = findModelById(data, "k-kwarc-60")!;
    const full = resolveConfiguration(
      toDomainData(data),
      defaultConfiguration(model as never),
    ).config;
    expect(explicitChoices(model, full.parts)).toEqual({});
    const changed = { ...full.parts, obudowa: { color: "turkus", finish: "mat" } };
    expect(Object.keys(explicitChoices(model, changed))).toEqual(["obudowa"]);
  });

  it("applyChoice: zmiana koloru zachowuje wykonczenie, niedozwolone zastepuje domyslnym, paleta bez wykonczen daje null", () => {
    const model = findModelById(data, "k-kwarc-60")!;
    const resolved = resolveConfiguration(
      toDomainData(data),
      defaultConfiguration(model as never),
    ).config;
    const next = applyChoice(data, model, resolved, {}, "obudowa", { color: "turkus" });
    expect(next.obudowa).toEqual({ color: "turkus", finish: "mat" });
    const bad = applyChoice(data, model, resolved, {}, "obudowa", { finish: "anodowane" });
    expect(bad.obudowa?.finish).toBe("mat");
    expect(
      applyChoice(data, model, resolved, {}, "legendy_alfa", { color: "czerwien" }).legendy_alfa,
    ).toEqual({
      color: "czerwien",
      finish: null,
    });
  });
});
