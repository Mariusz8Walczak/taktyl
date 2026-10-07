// F-104, F-105: reguly dopasowania kreatora z data/rules.json (docs/03 par. 4).
// Wynik nigdy nie blokuje dodania do koszyka (never_block); regula bez wymaganych elementow nie jest zwracana.
import type { Product, SkuEntry } from "./catalog.js";
import { formatCmFromMm, formatNumber, formatPLNSigned, type Grosze } from "./money.js";
import { pluralize, type PluralForms } from "./plural.js";

/** Ksztalt data/rules.json (pola uzywane przez domene). Jednostki: mm. */
export interface RulesConfig {
  profiles: Record<string, { label: string; mouse_zone_mm: number; default_switch: string }>;
  no_profile: { mouse_zone_mm: number; message: string };
  gap_keyboard_mouse_mm: number;
  edge_margin_mm: number;
  checks: {
    id: string;
    level_fail: "uwaga" | "info" | null;
    ok: string | null;
    fail: string | null;
  }[];
}

/** Ksztalt data/colors.json. */
export type ColorsConfig = Record<string, { code: string; label: string; harmony: string; swatch: string }>;

export type RuleLevel = "uwaga" | "ok" | "info";

export interface Suggestion {
  ruleId: string;
  /** SKU wariantu proponowanego w miejsce biezacego. */
  sku: string;
  /** Roznica ceny wzgledem biezacego wariantu (grosze, moze byc ujemna). */
  priceDelta: Grosze;
  /** Pelna tresc przycisku, np. "Zmień na Filc XXL (+50,00 zł)" (docs/03 par. 9). */
  label: string;
}

export interface RuleResult {
  id: string;
  level: RuleLevel;
  message: string;
  suggestion: Suggestion | null;
}

export interface SetSelection {
  /** id profilu z rules.json albo null (no_profile). */
  profile: string | null;
  /** Dlugosc dloni w cm albo null. */
  handCm: number | null;
  keyboard: SkuEntry | null;
  mouse: SkuEntry | null;
  pad: SkuEntry | null;
}

export interface FitReport {
  /** Kolejnosc: uwaga, ok, info (docs/03 par. 4.5); w obrebie poziomu - kolejnosc z rules.json. */
  results: RuleResult[];
  /** Strefa ruchu myszki uzyta w regulach (mm). */
  zoneMm: number;
  /** Komunikat no_profile.message, gdy profil nie jest ustawiony. */
  noProfileNotice: string | null;
  warnings: number;
  /** "Pasuje" albo "Pasuje z 1 uwagą" (odmiana przez PluralRules). */
  headline: string;
}

const WARNING_FORMS: PluralForms = { one: "uwagą", few: "uwagami", many: "uwagami" };
const LEVEL_ORDER: Record<RuleLevel, number> = { uwaga: 0, ok: 1, info: 2 };

/** F-104: naglowek listy wynikow (docs/03 par. 4.5). */
export function fitHeadline(warnings: number): string {
  return warnings === 0
    ? "Pasuje"
    : `Pasuje z ${warnings.toLocaleString("pl-PL")} ${pluralize(warnings, WARNING_FORMS)}`;
}

/** F-104: strefa ruchu myszki w mm dla profilu (no_profile gdy brak/nieznany). */
export function mouseZoneMm(profile: string | null, rules: RulesConfig): number {
  const p = profile === null ? undefined : rules.profiles[profile];
  return p ? p.mouse_zone_mm : rules.no_profile.mouse_zone_mm;
}

function fillTemplate(template: string, values: Record<string, string>): string {
  return template
    .replace(/\{(\w+)\}/g, (_m, key: string) => values[key] ?? "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function padSizeOf(entry: SkuEntry) {
  const key = entry.variant.size;
  return key === undefined ? undefined : entry.product.attributes.sizes?.[key];
}

function sizeLabelOf(product: Product, sizeKey: string | undefined): string {
  return sizeKey === undefined ? "" : (product.attributes.sizes?.[sizeKey]?.label ?? sizeKey);
}

function handRangeOf(product: Product): [number, number] | undefined {
  return product.attributes.hand_cm;
}

function cheaperFirst<T extends { price: number; order: number }>(a: T, b: T): number {
  return a.price - b.price || a.order - b.order;
}

interface PadCandidate {
  entry: SkuEntry;
  size: NonNullable<ReturnType<typeof padSizeOf>>;
  price: Grosze;
  order: number;
}

function padCandidates(catalog: readonly Product[]): PadCandidate[] {
  const out: PadCandidate[] = [];
  let order = 0;
  for (const product of catalog) {
    if (product.category !== "podkladki") continue;
    for (const variant of product.variants) {
      order++;
      if (variant.stock <= 0) continue;
      const entry: SkuEntry = { product, variant };
      const size = padSizeOf(entry);
      if (!size) continue;
      out.push({ entry, size, price: variant.price, order });
    }
  }
  return out;
}

function padSuggestionLabel(target: SkuEntry, current: SkuEntry): { label: string; delta: Grosze } {
  const delta = target.variant.price - current.variant.price;
  const name = `${target.product.name} ${sizeLabelOf(target.product, target.variant.size)}`;
  return { label: `Zmień na ${name} (${formatPLNSigned(delta)})`, delta };
}

/**
 * F-105 (docs/03 par. 4.3): propozycja podkladki. Kolejnosc: 1) wiekszy rozmiar tego samego modelu
 * i koloru, 2) najtansza dostepna z fit[profil] >= 2, 3) najtansza dostepna spelniajaca regule.
 * Remis ceny: ten sam kolor co biezaca, potem kolejnosc w katalogu.
 */
function suggestPad(
  ruleId: string,
  current: SkuEntry,
  satisfies: (size: PadCandidate["size"]) => boolean,
  profile: string | null,
  catalog: readonly Product[],
): Suggestion | null {
  const currentSize = padSizeOf(current);
  const all = padCandidates(catalog).filter(
    (c) => c.entry.variant.sku !== current.variant.sku && satisfies(c.size),
  );
  const sameColorFirst = (a: PadCandidate, b: PadCandidate): number =>
    a.price - b.price ||
    Number(b.entry.variant.color === current.variant.color) -
      Number(a.entry.variant.color === current.variant.color) ||
    a.order - b.order;

  let pick: PadCandidate | undefined;
  // 1) wiekszy rozmiar tego samego modelu i koloru
  pick = all
    .filter(
      (c) =>
        c.entry.product.id === current.product.id &&
        c.entry.variant.color === current.variant.color &&
        currentSize !== undefined &&
        c.size.w > currentSize.w,
    )
    .sort((a, b) => a.size.w - b.size.w || cheaperFirst(a, b))[0];
  // 2) najtansza z fit[profil] >= 2
  if (!pick && profile !== null) {
    pick = all
      .filter((c) => (c.entry.product.fit[profile] ?? 0) >= 2)
      .sort(sameColorFirst)[0];
  }
  // 3) najtansza spelniajaca regule
  if (!pick) pick = [...all].sort(sameColorFirst)[0];
  if (!pick) return null;

  const { label, delta } = padSuggestionLabel(pick.entry, current);
  return { ruleId, sku: pick.entry.variant.sku, priceDelta: delta, label };
}

interface MouseSuggestionResult {
  suggestion: Suggestion;
  /** true, gdy zadna myszka nie obejmuje dloni (krok 3) */
  nearestOnly: boolean;
  target: SkuEntry;
}

function handDistance(range: [number, number], hand: number): number {
  return hand < range[0] ? range[0] - hand : hand > range[1] ? hand - range[1] : 0;
}

/**
 * F-105 (docs/03 par. 4.3): propozycja myszki. 1) ten sam ksztalt z zakresem obejmujacym dlon,
 * 2) dowolna obejmujaca dlon, 3) najblizszy zakres. Wsrod rownorzednych: fit[profil] malejaco,
 * potem cena wariantu rosnaco, potem kolejnosc w katalogu.
 */
function suggestMouse(
  current: SkuEntry,
  handCm: number,
  profile: string | null,
  catalog: readonly Product[],
): MouseSuggestionResult | null {
  interface Cand {
    entry: SkuEntry;
    range: [number, number];
    fit: number;
    price: number;
    order: number;
  }
  const cands: Cand[] = [];
  catalog.forEach((product, order) => {
    if (product.category !== "myszki" || product.id === current.product.id) return;
    const range = handRangeOf(product);
    if (!range) return;
    const inStock = product.variants.filter((v) => v.stock > 0);
    const variant =
      inStock.find((v) => v.color === current.variant.color) ??
      [...inStock].sort((a, b) => a.price - b.price)[0];
    if (!variant) return;
    cands.push({
      entry: { product, variant },
      range,
      fit: profile === null ? 0 : (product.fit[profile] ?? 0),
      price: variant.price,
      order,
    });
  });

  const byFit = (a: Cand, b: Cand): number => b.fit - a.fit || a.price - b.price || a.order - b.order;
  const covers = (c: Cand): boolean => handDistance(c.range, handCm) === 0;
  const sameShape = (c: Cand): boolean =>
    c.entry.product.attributes.shape === current.product.attributes.shape;

  let pick = cands.filter((c) => covers(c) && sameShape(c)).sort(byFit)[0];
  let nearestOnly = false;
  if (!pick) pick = cands.filter(covers).sort(byFit)[0];
  if (!pick) {
    nearestOnly = true;
    pick = [...cands].sort(
      (a, b) => handDistance(a.range, handCm) - handDistance(b.range, handCm) || byFit(a, b),
    )[0];
  }
  if (!pick) return null;

  const delta = pick.entry.variant.price - current.variant.price;
  return {
    nearestOnly,
    target: pick.entry,
    suggestion: {
      ruleId: "hand-size",
      sku: pick.entry.variant.sku,
      priceDelta: delta,
      label: `Zmień na ${pick.entry.product.name} (${formatPLNSigned(delta)})`,
    },
  };
}

/**
 * F-104, F-105: ocena setu wg rules.json. Czysta funkcja; zwraca tylko reguly, ktorych elementy
 * wystepuja w wyborze; komunikaty z szablonow `checks[].ok/fail`.
 */
export function evaluateFit(
  selection: SetSelection,
  rules: RulesConfig,
  colors: ColorsConfig,
  catalog: readonly Product[],
): FitReport {
  const { keyboard, mouse, pad, handCm } = selection;
  const profile =
    selection.profile !== null && rules.profiles[selection.profile] ? selection.profile : null;
  const profileData = profile === null ? undefined : rules.profiles[profile];
  const zone = mouseZoneMm(profile, rules);
  const margin = rules.edge_margin_mm;
  const gap = rules.gap_keyboard_mouse_mm;
  const kb = keyboard?.product.attributes.dims_mm;
  const padSize = pad ? padSizeOf(pad) : undefined;
  const mouseRange = mouse ? handRangeOf(mouse.product) : undefined;

  const cm = formatCmFromMm;
  const results: RuleResult[] = [];

  const template = (id: string) => rules.checks.find((c) => c.id === id);
  const push = (
    id: string,
    ok: boolean,
    values: Record<string, string>,
    suggestion: Suggestion | null = null,
    alwaysInfo = false,
  ): void => {
    const check = template(id);
    if (!check) return;
    if (alwaysInfo) {
      if (check.fail) results.push({ id, level: "info", message: fillTemplate(check.fail, values), suggestion: null });
      return;
    }
    if (ok) {
      if (check.ok) results.push({ id, level: "ok", message: fillTemplate(check.ok, values), suggestion: null });
    } else if (check.fail && check.level_fail) {
      results.push({
        id,
        level: check.level_fail,
        message: fillTemplate(check.fail, { ...values, suggestion: "" }),
        suggestion,
      });
    }
  };

  for (const check of rules.checks) {
    switch (check.id) {
      case "pad-width-desk": {
        if (!pad || !kb || !mouse || padSize?.type !== "biurko") break;
        const required = 2 * margin + kb.w + gap + zone;
        const ok = padSize.w >= required;
        const suggestion = ok
          ? null
          : suggestPad(
              check.id,
              pad,
              (s) => s.type === "biurko" && s.w >= required && s.d >= kb.d + 2 * margin,
              profile,
              catalog,
            );
        push(
          check.id,
          ok,
          {
            kb_cm: cm(kb.w),
            zone_cm: cm(zone),
            spare_cm: cm(padSize.w - required),
            pad_cm: cm(padSize.w),
            req_cm: cm(required),
          },
          suggestion,
        );
        break;
      }
      case "pad-depth-desk": {
        if (!pad || !kb || padSize?.type !== "biurko") break;
        push(check.id, padSize.d >= kb.d + 2 * margin, {
          kb_d_cm: cm(kb.d),
          pad_d_cm: cm(padSize.d),
        });
        break;
      }
      case "pad-width-mouse": {
        if (!pad || !mouse || padSize?.type !== "mysz") break;
        const ok = padSize.w >= zone;
        const suggestion = ok
          ? null
          : suggestPad(check.id, pad, (s) => s.type === "mysz" && s.w >= zone, profile, catalog);
        push(
          check.id,
          ok,
          {
            pad_cm: cm(padSize.w),
            zone_cm: cm(zone),
            profile: profileData?.label ?? "bez profilu",
          },
          suggestion,
        );
        break;
      }
      case "hand-size": {
        if (!mouse || handCm === null || !mouseRange) break;
        const [min, max] = mouseRange;
        const ok = min <= handCm && handCm <= max;
        const found = ok ? null : suggestMouse(mouse, handCm, profile, catalog);
        const values: Record<string, string> = {
          hand: formatNumber(handCm, 1),
          min: formatNumber(min, 1),
          max: formatNumber(max, 1),
          mouse: mouse.product.name,
        };
        const checkDef = template(check.id);
        if (!ok && checkDef?.fail && checkDef.level_fail) {
          let extra = "";
          if (found?.nearestOnly) {
            const r = handRangeOf(found.target.product) ?? [0, 0];
            extra = `Żadna myszka w katalogu nie jest projektowana na dłoń ${formatNumber(handCm, 1)} cm. Najbliżej: ${found.target.product.name} (${formatNumber(r[0], 1)}–${formatNumber(r[1], 1)} cm).`;
          }
          results.push({
            id: check.id,
            level: checkDef.level_fail,
            message: fillTemplate(checkDef.fail, { ...values, suggestion: extra }),
            suggestion: found?.suggestion ?? null,
          });
        } else if (ok) {
          push(check.id, true, values);
        }
        break;
      }
      case "two-receivers": {
        if (!keyboard || !mouse) break;
        const kbConn = keyboard.product.attributes.connectivity ?? [];
        const mConn = mouse.product.attributes.connectivity ?? [];
        if (kbConn.includes("2.4ghz") && mConn.includes("2.4ghz")) push(check.id, false, {}, null, true);
        break;
      }
      case "color-harmony": {
        if (!keyboard || !mouse || !pad) break;
        const picks = [keyboard, mouse, pad].map((e) => colors[e.variant.color]);
        if (picks.some((c) => c === undefined)) break;
        const known = picks as ColorsConfig[string][];
        const nonNeutral = known.filter((c) => c.harmony !== "neutralny");
        const harmonies = new Set(nonNeutral.map((c) => c.harmony));
        // Elementy neutralne pasuja do kazdego koloru (docs/decyzje.md, TAKTYL-13).
        if (harmonies.size <= 1) {
          const shown = nonNeutral[0] ?? (known[known.length - 1] as ColorsConfig[string]);
          push(check.id, true, { color: shown.label });
        }
        break;
      }
      default:
        break;
    }
  }

  const ordered = results
    .map((r, i) => ({ r, i }))
    .sort((a, b) => LEVEL_ORDER[a.r.level] - LEVEL_ORDER[b.r.level] || a.i - b.i)
    .map((x) => x.r);
  const warnings = ordered.filter((r) => r.level === "uwaga").length;

  return {
    results: ordered,
    zoneMm: zone,
    noProfileNotice: profile === null ? rules.no_profile.message : null,
    warnings,
    headline: fitHeadline(warnings),
  };
}

/**
 * F-107 (docs/03 par. 6, niepelny set): najtansza dostepna podkladka spelniajaca reguly szerokosci
 * dla biezacej klawiatury i myszki (typ biurko wg reguly pad-width-desk, typ mysz wg pad-width-mouse).
 * Bez klawiatury lub myszki: najtansza dostepna podkladka w ogole. Null, gdy brak.
 */
export function cheapestCompliantPad(
  selection: Pick<SetSelection, "profile" | "keyboard" | "mouse">,
  rules: RulesConfig,
  catalog: readonly Product[],
): SkuEntry | null {
  const profile =
    selection.profile !== null && rules.profiles[selection.profile] ? selection.profile : null;
  const zone = mouseZoneMm(profile, rules);
  const margin = rules.edge_margin_mm;
  const kb = selection.keyboard?.product.attributes.dims_mm;
  const hasMouse = selection.mouse !== null;
  const requiredDesk = kb ? 2 * margin + kb.w + rules.gap_keyboard_mouse_mm + zone : 0;

  const ok = (size: PadCandidate["size"]): boolean => {
    if (size.type === "biurko") {
      if (!kb || !hasMouse) return true;
      return size.w >= requiredDesk && size.d >= kb.d + 2 * margin;
    }
    return !hasMouse || size.w >= zone;
  };
  const best = padCandidates(catalog)
    .filter((c) => ok(c.size))
    .sort(cheaperFirst)[0];
  return best ? best.entry : null;
}
