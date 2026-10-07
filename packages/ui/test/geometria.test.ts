// F-106: geometria podgladu biurka (docs/03 §5.1) na przykladach kontrolnych z docs/03 §4.4.
// Wymiary i parametry czytane z data/*.json (sciezka wzgledna do roota repo), bez wlasnych liczb.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeDeskGeometry, NO_PAD_CANVAS } from "../src/index.js";
import type { PadType } from "../src/index.js";

const root = join(__dirname, "..", "..", "..");
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(join(root, "data", `${name}.json`), "utf8")) as T;

interface RawProduct {
  slug: string;
  attributes: {
    dims_mm?: { w: number; d: number };
    sizes?: Record<string, { w: number; d: number; type: PadType }>;
  };
}
interface Rules {
  profiles: Record<string, { mouse_zone_mm: number }>;
  no_profile: { mouse_zone_mm: number };
  gap_keyboard_mouse_mm: number;
  edge_margin_mm: number;
}
const products = read<RawProduct[]>("products");
const rules = read<Rules>("rules");
const product = (slug: string): RawProduct => {
  const p = products.find((x) => x.slug === slug);
  if (!p) throw new Error(`brak ${slug}`);
  return p;
};
const dims = (slug: string) => {
  const d = product(slug).attributes.dims_mm!;
  return { w: d.w, d: d.d };
};
const padSize = (slug: string, size: string) => product(slug).attributes.sizes![size]!;

const gapMm = rules.gap_keyboard_mouse_mm;
const marginMm = rules.edge_margin_mm;
const zone = (profile: string) => rules.profiles[profile]!.mouse_zone_mm;

describe("computeDeskGeometry (docs/03 §5.1)", () => {
  it("mata: Bazalt 75 + Pustulka + Szron XL (programowanie): wymagane 617, mata 900, zapas 28,3 cm", () => {
    const kb = dims("bazalt-75");
    const pad = padSize("szron", "xl");
    const g = computeDeskGeometry({
      keyboard: kb,
      mouse: dims("pustulka"),
      pad,
      zoneMm: zone("programowanie"),
      gapMm,
      marginMm,
    });
    expect(g.layout).toBe("mata");
    expect(g.requiredMm).toBe(2 * marginMm + kb.w + gapMm + zone("programowanie"));
    expect(g.requiredMm).toBe(617);
    expect(g.canvas).toEqual({ w: Math.max(pad.w, 617), d: Math.max(pad.d, kb.d + 2 * marginMm) });
    expect(g.canvas.w).toBe(900);
    expect(g.spareMm).toBe(283);
    expect(g.pad).toEqual({ x: 0, y: 0, w: pad.w, d: pad.d });
    expect(g.keyboard).toEqual({ x: marginMm, y: (g.canvas.d - kb.d) / 2, w: kb.w, d: kb.d });
    expect(g.zone.x).toBe(marginMm + kb.w + gapMm);
    expect(g.zone.w).toBe(zone("programowanie"));
    expect(g.zone.d).toBe(pad.d - 2 * marginMm);
    expect(g.zoneOutside).toBeNull();
    const m = g.mouse!;
    expect(m.x + m.w / 2).toBe(g.zone.x + g.zone.w / 2);
    expect(m.y + m.d / 2).toBe(g.zone.y + g.zone.d / 2);
  });

  it("mata: Marmur 100 + Jerzyk + Filc XL (fps): 910 mm wobec 900 mm, uwaga, brak 10 mm marginesu", () => {
    const pad = padSize("filc", "xl");
    const g = computeDeskGeometry({
      keyboard: dims("marmur-100"),
      mouse: dims("jerzyk"),
      pad,
      zoneMm: zone("fps"),
      gapMm,
      marginMm,
    });
    expect(g.requiredMm).toBe(910);
    expect(pad.w).toBe(900);
    expect(g.spareMm).toBe(-10);
    expect(g.canvas.w).toBe(910);
    // strefa konczy sie przed krawedzia maty; brakuje tylko prawego marginesu (10 mm), wiec nic nie wystaje
    expect(g.zone.x + g.zone.w).toBeLessThan(pad.w);
    expect(g.zoneOutside).toBeNull();
  });

  it("podkladka pod myszke: Kwarc 60 + Jerzyk + Len M (fps): strefa 400 wobec 360, uwaga", () => {
    const kb = dims("kwarc-60");
    const pad = padSize("len", "m");
    expect(pad.type).toBe("mysz");
    const g = computeDeskGeometry({
      keyboard: kb,
      mouse: dims("jerzyk"),
      pad,
      zoneMm: zone("fps"),
      gapMm,
      marginMm,
    });
    const padX = marginMm + kb.w + gapMm;
    expect(g.layout).toBe("podkladka");
    expect(g.requiredMm).toBe(400);
    expect(g.spareMm).toBe(pad.w - 400);
    expect(g.canvas.w).toBe(marginMm + kb.w + gapMm + Math.max(pad.w, 400) + marginMm);
    expect(g.canvas.d).toBe(Math.max(pad.d, kb.d + 2 * marginMm));
    expect(g.pad).toMatchObject({ x: padX, w: pad.w, d: pad.d });
    expect(g.zone).toMatchObject({ x: padX, w: 400, d: pad.d - 2 * marginMm });
    expect(g.zoneOutside).toMatchObject({ x: padX + pad.w, w: 40 });
    const m = g.mouse!;
    expect(m.x + m.w / 2).toBe(g.pad!.x + g.pad!.w / 2);
    expect(m.y + m.d / 2).toBe(g.pad!.y + g.pad!.d / 2);
  });

  it("podkladka szersza niz strefa: brak czesci poza podkladka, plotno wg podkladki", () => {
    const kb = dims("kwarc-60");
    const pad = padSize("len", "l");
    const g = computeDeskGeometry({
      keyboard: kb,
      mouse: dims("jerzyk"),
      pad,
      zoneMm: zone("programowanie"),
      gapMm,
      marginMm,
    });
    expect(g.zoneOutside).toBeNull();
    expect(g.spareMm).toBe(pad.w - zone("programowanie"));
    expect(g.canvas.w).toBe(marginMm + kb.w + gapMm + pad.w + marginMm);
  });

  it("brak podkladki: plotno 900 x 400, klawiatura w polowie wysokosci, strefa za klawiatura", () => {
    const kb = dims("bazalt-75");
    const g = computeDeskGeometry({
      keyboard: kb,
      mouse: dims("pustulka"),
      pad: null,
      zoneMm: rules.no_profile.mouse_zone_mm,
      gapMm,
      marginMm,
    });
    expect(g.layout).toBe("brak");
    expect(g.canvas).toEqual(NO_PAD_CANVAS);
    expect(g.keyboard).toEqual({ x: marginMm, y: (400 - kb.d) / 2, w: kb.w, d: kb.d });
    expect(g.zone.x).toBe(marginMm + kb.w + gapMm);
    expect(g.zone.w).toBe(rules.no_profile.mouse_zone_mm);
    expect(g.requiredMm).toBeNull();
    expect(g.spareMm).toBeNull();
    expect(g.zoneOutside).toBeNull();
  });

  it("bez klawiatury i myszki: sama strefa, brak elementow", () => {
    const g = computeDeskGeometry({
      keyboard: null,
      mouse: null,
      pad: null,
      zoneMm: 260,
      gapMm,
      marginMm,
    });
    expect(g.keyboard).toBeNull();
    expect(g.mouse).toBeNull();
    expect(g.canvas).toEqual(NO_PAD_CANVAS);
  });
});
