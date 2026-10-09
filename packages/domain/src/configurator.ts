// Konfigurator kolorow 3D (ADR-0011, F-110..F-119): walidacja, normalizacja, doplaty w groszach, SKU.
// Czysta logika bez I/O; dane (`data/colors|finishes|parts|prints|surcharges.json`) dostarcza wywolujacy.
import type { Grosze } from "./money.js";

export interface ConfColor {
  code: string;
  label: string;
  harmony: string;
  swatch: string;
}
export interface ConfFinish {
  code: string;
  label: string;
  pbr: Record<string, number | string | boolean>;
}
export interface ConfPalette {
  wykonczenia: string[];
  /** Lista kolorow albo odwolanie `jak <paleta>` (np. przyciski myszki maja kolory korpusu). */
  kolory: string[] | string;
  auto?: string;
}
export interface ConfPart {
  id: string;
  etykieta: string;
  konfigurowalna: boolean;
  paleta?: string | null;
  domyslnie: { kolor: string | null; wykonczenie: string | null };
}
export interface ConfModel {
  id: string;
  product: string;
  size: string | null;
  sku_prefix: string;
  name: string;
  file: string;
  dims_mm: number[];
  parts: ConfPart[];
}
export interface ConfPrint {
  id: string;
  nazwa: string;
  dla: string[];
  tryb: string;
}
export interface ConfSurcharges {
  series: string[];
  keyboards: Record<string, number>;
  mice: Record<string, number>;
  pads: Record<string, number>;
}
export interface ConfData {
  colors: Record<string, ConfColor>;
  finishes: Record<string, ConfFinish>;
  palettes: Record<string, ConfPalette>;
  models: ConfModel[];
  prints: ConfPrint[];
  surcharges: ConfSurcharges;
}

/** Wybor dla jednej czesci. Kolor "auto" dozwolony tylko w paletach z `auto: "kontrast"` (nadruki klawiszy). */
export interface ConfPartChoice {
  color: string;
  finish: string | null;
}
export interface Configuration {
  model: string;
  parts: Record<string, ConfPartChoice>;
  /** Id nadruku podkladki (`prints.json`); wtedy `wierzch` ignoruje kolor. */
  print?: string | null;
}

export type ConfIssueCode =
  | "unknown_model"
  | "unknown_part"
  | "unknown_color"
  | "unknown_finish"
  | "finish_not_allowed"
  | "needs_backlight"
  | "unknown_print"
  | "print_not_for_model";
export interface ConfIssue {
  code: ConfIssueCode;
  part?: string;
  message: string;
}
export interface ConfAdjustment {
  part: string;
  from: string;
  to: string;
  reason: "contrast";
}
export interface ConfResult {
  ok: boolean;
  issues: ConfIssue[];
  /** Konfiguracja po uzupelnieniu domyslnych i podmianie nadrukow o slabym kontrascie. */
  config: Configuration;
  adjustments: ConfAdjustment[];
}

export const MIN_LEGEND_CONTRAST = 3;
const LEGEND_FALLBACKS = ["biel", "czern"] as const;
/** Nadruki -> grupa klawiszy, na ktorej leza. */
const LEGEND_OF: Record<string, string> = {
  legendy_alfa: "klawisze_alfa",
  legendy_mod: "klawisze_mod",
  legendy_akcent: "klawisze_akcent",
};
const BACKLIGHT_FINISHES = new Set(["polprzezroczyste", "akryl", "jelly"]);

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
/** Luminancja wzgledna WCAG z `#rrggbb`. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Zly kolor: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
/** Kontrast WCAG 1..21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export function findModel(data: ConfData, id: string): ConfModel | undefined {
  return data.models.find((m) => m.id === id);
}

function paletteColors(data: ConfData, key: string): string[] {
  const p = data.palettes[key];
  if (!p) return [];
  return typeof p.kolory === "string" ? paletteColors(data, p.kolory.replace(/^jak /, "")) : p.kolory;
}
/** Czesci, ktore bez wyraznego wyboru przejmuja wybor czesci nadrzednej (obudowa -> spod, pokretlo; korpus -> przyciski). */
const FOLLOWS: Record<string, string> = {
  obudowa_spod: "obudowa",
  pokretlo: "obudowa",
  przyciski: "korpus",
  przyciski_boczne: "korpus",
};

function category(model: ConfModel): "keyboards" | "mice" | "pads" {
  return model.id.startsWith("k-") ? "keyboards" : model.id.startsWith("m-") ? "mice" : "pads";
}
function partOf(model: ConfModel, id: string): ConfPart | undefined {
  return model.parts.find((p) => p.id === id);
}

/** Domyslna konfiguracja modelu (czesci konfigurowalne z `domyslnie`). */
export function defaultConfiguration(model: ConfModel): Configuration {
  const parts: Record<string, ConfPartChoice> = {};
  for (const p of model.parts) {
    if (p.konfigurowalna && p.domyslnie.kolor) parts[p.id] = { color: p.domyslnie.kolor, finish: p.domyslnie.wykonczenie };
  }
  return { model: model.id, parts, print: null };
}

/**
 * Waliduje konfiguracje wzgledem palet czesci i ograniczen technicznych (ADR-0011 pkt 3),
 * uzupelnia brakujace czesci domyslnymi i podmienia nadruki o kontrascie < 3:1 na biel/czern.
 */
export function resolveConfiguration(data: ConfData, input: Configuration): ConfResult {
  const issues: ConfIssue[] = [];
  const adjustments: ConfAdjustment[] = [];
  const model = findModel(data, input.model);
  if (!model) {
    return {
      ok: false,
      issues: [{ code: "unknown_model", message: `Nieznany model: ${input.model}` }],
      config: input,
      adjustments,
    };
  }
  const parts: Record<string, ConfPartChoice> = { ...defaultConfiguration(model).parts };

  for (const [id, choice] of Object.entries(input.parts)) {
    const part = partOf(model, id);
    if (!part || !part.konfigurowalna || !part.paleta) {
      issues.push({ code: "unknown_part", part: id, message: `Czesc ${id} nie jest konfigurowalna w ${model.id}` });
      continue;
    }
    const palette = data.palettes[part.paleta]!;
    const isAuto = choice.color === "auto" && palette.auto === "kontrast";
    if (!isAuto && !paletteColors(data, part.paleta).includes(choice.color)) {
      issues.push({ code: "unknown_color", part: id, message: `Kolor ${choice.color} spoza palety ${part.paleta}` });
      continue;
    }
    if (palette.wykonczenia.length === 0) {
      parts[id] = { color: choice.color, finish: null };
      continue;
    }
    if (!choice.finish || !data.finishes[choice.finish]) {
      issues.push({ code: "unknown_finish", part: id, message: `Nieznane wykonczenie: ${choice.finish}` });
      continue;
    }
    if (!palette.wykonczenia.includes(choice.finish)) {
      issues.push({ code: "finish_not_allowed", part: id, message: `Wykonczenie ${choice.finish} niedostepne dla ${id}` });
      continue;
    }
    if (BACKLIGHT_FINISHES.has(choice.finish) && !partOf(model, "podswietlenie")) {
      issues.push({ code: "needs_backlight", part: id, message: `Wykonczenie ${choice.finish} wymaga podswietlenia` });
      continue;
    }
    parts[id] = { color: choice.color, finish: choice.finish };
  }

  // Czesci zalezne bez wlasnego wyboru podazaja za nadrzedna, o ile ich paleta to dopuszcza.
  for (const [child, parent] of Object.entries(FOLLOWS)) {
    const part = partOf(model, child);
    const from = parts[parent];
    if (!part?.paleta || !from || input.parts[child]) continue;
    const palette = data.palettes[part.paleta]!;
    if (paletteColors(data, part.paleta).includes(from.color) && (!from.finish || palette.wykonczenia.includes(from.finish))) {
      parts[child] = { ...from };
    }
  }

  const print = input.print ?? null;
  if (print) {
    const p = data.prints.find((x) => x.id === print);
    if (!p) issues.push({ code: "unknown_print", message: `Nieznany nadruk: ${print}` });
    else if (!p.dla.includes(model.product)) issues.push({ code: "print_not_for_model", message: `Nadruk ${print} nie pasuje do ${model.product}` });
  }

  // Kontrast nadrukow na klawiszach (auto albo wybor ponizej 3:1).
  for (const [legendId, keysId] of Object.entries(LEGEND_OF)) {
    const legend = parts[legendId];
    const keys = parts[keysId];
    if (!legend || !keys) continue;
    const keySwatch = data.colors[keys.color]?.swatch;
    if (!keySwatch) continue;
    const wanted = legend.color === "auto" ? null : legend.color;
    const wantedSwatch = wanted ? data.colors[wanted]?.swatch : null;
    if (wantedSwatch && contrastRatio(wantedSwatch, keySwatch) >= MIN_LEGEND_CONTRAST) continue;
    const best = [...LEGEND_FALLBACKS]
      .map((c) => ({ c, r: contrastRatio(data.colors[c]!.swatch, keySwatch) }))
      .sort((a, b) => b.r - a.r)[0]!.c;
    parts[legendId] = { color: best, finish: null };
    if (wanted && wanted !== best) adjustments.push({ part: legendId, from: wanted, to: best, reason: "contrast" });
  }

  return { ok: issues.length === 0, issues, config: { model: model.id, parts, print }, adjustments };
}

const zl = (v: number): Grosze => Math.round(v * 100);

/** Doplata konfiguracji nad cene modelu bazowego, w groszach (ADR-0011 pkt 4). Wymaga poprawnej konfiguracji. */
export function configurationSurcharge(data: ConfData, config: Configuration): Grosze {
  const model = findModel(data, config.model);
  if (!model) throw new Error(`Nieznany model: ${config.model}`);
  const s = data.surcharges;
  const series = new Set(s.series);
  /** Kolor bez doplaty: z serii albo domyslny dla czesci w tym modelu (np. antracyt w Bazalcie). */
  const isFree = (partId: string, color: string): boolean =>
    series.has(color) || partOf(model, partId)?.domyslnie.kolor === color;
  const cat = category(model);
  let total = 0;

  if (cat === "keyboards") {
    const k = s.keyboards;
    const c = config.parts.obudowa;
    if (c) {
      const inSeries = isFree("obudowa", c.color);
      switch (c.finish) {
        case "mat": total += inSeries ? 0 : k.case_off_series_mat!; break;
        case "polysk": total += k.case_gloss!; break;
        case "opal": total += k.case_opal!; break;
        case "anodowane": total += inSeries ? 0 : k.case_anodized_off_series!; break;
        case "polprzezroczyste": total += k.case_translucent!; break;
        case "akryl": total += k.case_acrylic!; break;
      }
      const spod = config.parts.obudowa_spod;
      if (spod && (spod.color !== c.color || spod.finish !== c.finish)) total += k.case_two_tone!;
      const knob = config.parts.pokretlo;
      if (knob && knob.color !== c.color) total += k.knob_other_color!;
    }
    const jelly = ["klawisze_alfa", "klawisze_mod", "klawisze_akcent"].some((id) => config.parts[id]?.finish === "jelly");
    if (jelly) total += k.keys_jelly!;
  } else if (cat === "mice") {
    const m = s.mice;
    const body = config.parts.korpus;
    if (body) {
      switch (body.finish) {
        case "mat": total += isFree("korpus", body.color) ? 0 : m.body_off_series_mat!; break;
        case "polysk": total += m.body_gloss!; break;
        case "opal": total += m.body_opal!; break;
      }
      const btn = config.parts.przyciski;
      if (btn && btn.color !== body.color) total += m.buttons_other_color!;
    }
  } else {
    if (config.print) total += s.pads.print!;
    const glass = config.parts.nadruk;
    const def = partOf(model, "nadruk")?.domyslnie;
    if (glass && def && glass.color !== def.kolor) total += s.pads.print_under_glass!;
  }
  return zl(total);
}

// --- SKU konfiguracji: <prefiks modelu>-CFG-<kody czesci rozdzielone kropka> (po resolveConfiguration: nadruki "auto" to konkretny kolor) ---

function printToken(printId: string): string {
  return `N${printId.replace(/^p-/, "").toUpperCase()}`;
}

/** Kody czesci w kolejnosci z `parts.json`; wierzch podkladki z nadrukiem = `N<NADRUK>`. */
export function configurationSku(data: ConfData, config: Configuration): string {
  const model = findModel(data, config.model);
  if (!model) throw new Error(`Nieznany model: ${config.model}`);
  const tokens: string[] = [];
  for (const part of model.parts) {
    if (!part.konfigurowalna || !part.paleta) continue;
    const choice = config.parts[part.id];
    if (!choice) throw new Error(`Brak czesci ${part.id}`);
    if (part.id === "wierzch" && config.print) {
      tokens.push(printToken(config.print));
      continue;
    }
    const color = data.colors[choice.color]!.code;
    const finish = choice.finish ? data.finishes[choice.finish]!.code : "";
    tokens.push(color + finish);
  }
  return `${model.sku_prefix}-CFG-${tokens.join(".")}`;
}

/**
 * Odwrotnosc `configurationSku`; null dla SKU, ktorego nie da sie odtworzyc.
 * Wynik trzeba przepuscic przez `resolveConfiguration` (walidacja palet i ograniczen).
 */
export function parseConfigurationSku(data: ConfData, sku: string): Configuration | null {
  const at = sku.indexOf("-CFG-");
  if (at < 0) return null;
  const prefix = sku.slice(0, at);
  const rest = sku.slice(at + 5);
  const tokens = rest === "" ? [] : rest.split(".");
  const colorByCode = new Map(Object.entries(data.colors).map(([k, c]) => [c.code, k]));
  const finishByCode = new Map(Object.entries(data.finishes).map(([k, f]) => [f.code, k]));
  for (const model of data.models.filter((m) => m.sku_prefix === prefix)) {
    const slots = model.parts.filter((p) => p.konfigurowalna && p.paleta);
    if (slots.length !== tokens.length) continue;
    const parts: Record<string, ConfPartChoice> = {};
    let print: string | null = null;
    let valid = true;
    slots.forEach((slot, i) => {
      const t = tokens[i]!;
      if (slot.id === "wierzch" && t.startsWith("N")) {
        const id = `p-${t.slice(1).toLowerCase()}`;
        if (!data.prints.some((p) => p.id === id)) {
          valid = false;
          return;
        }
        print = id;
        const d = slot.domyslnie;
        parts[slot.id] = { color: d.kolor!, finish: d.wykonczenie };
        return;
      }
      const color = colorByCode.get(t.slice(0, 3));
      const finishCode = t.slice(3);
      const finish = finishCode ? finishByCode.get(finishCode) : null;
      if (!color || (finishCode && !finish)) {
        valid = false;
        return;
      }
      parts[slot.id] = { color, finish: finish ?? null };
    });
    if (valid) return { model: model.id, parts, print };
  }
  return null;
}
