// F-021...F-025: silnik filtrow, facetow i sortowania listingu (docs/04 par. 6, data/facets.json).
// Czysta logika: zero DOM i I/O. Ceny w groszach (zakres ceny w adresie jest w zlotych).
import type { Product, Variant } from "./catalog.js";
import type { ColorsConfig } from "./rules.js";
import { formatCount, PRODUCT_FORMS } from "./plural.js";
import { formatNumber, formatWithUnit, toGrosze, type Grosze } from "./money.js";

export type FacetType = "multi" | "range" | "bool" | "buckets" | "number-match";

export interface FacetValueDef {
  v: string;
  label: string;
  min?: number;
  max?: number;
}

/** Ksztalt wpisu w data/facets.json. */
export interface FacetDef {
  id: string;
  label: string;
  type: FacetType;
  attr: string;
  unit?: string;
  hint?: string;
  values?: FacetValueDef[];
}

export type FacetsConfig = Record<string, FacetDef[]>;

export interface RangeValue {
  min: number | null;
  max: number | null;
}

/** multi/buckets: wybrane `v`; range: zakres; bool: true; number-match: liczba. */
export type FilterValue = string[] | RangeValue | boolean | number;

/** Tylko aktywne filtry, klucz = id facetu. */
export type FilterState = Record<string, FilterValue>;

export interface FilterContext {
  /** switches.json (id -> type dla `variant.switch.type`) */
  switches: readonly { id: string; type: string }[];
  colors: ColorsConfig;
}

export type SortKey = "polecane" | "cena-rosnaco" | "cena-malejaco" | "nowosci" | "najlzejsze";

export const SORT_KEYS: readonly SortKey[] = [
  "polecane",
  "cena-rosnaco",
  "cena-malejaco",
  "nowosci",
  "najlzejsze",
];

export interface ListingItem {
  product: Product;
  /** Warianty spelniajace filtry wariantowe (wszystkie, gdy brak takich filtrow). */
  variants: Variant[];
  /** Pierwszy pasujacy wariant: zdjecie i cena karty (docs/04 par. 6). */
  displayVariant: Variant | undefined;
}

export interface FacetValueResult {
  v: string;
  label: string;
  count: number;
  /** Wartosc z zerem wynikow jest nieaktywna (chyba ze jest aktualnie wybrana). */
  disabled: boolean;
  selected: boolean;
  /** Kolor probki z colors.json dla facetu koloru. */
  swatch?: string;
}

export interface FacetResult {
  id: string;
  label: string;
  type: FacetType;
  values: FacetValueResult[];
  /** bool: liczba produktow po wlaczeniu filtra. */
  count?: number;
  /** range: minimalna i maksymalna wartosc w katalogu (grosze dla ceny). */
  bounds?: { min: number; max: number };
}

// ---------------------------------------------------------------------------
// Dopasowanie
// ---------------------------------------------------------------------------

function isVariantAttr(attr: string): boolean {
  return attr.startsWith("variant.");
}

/** Surowa wartosc atrybutu dla produktu (i wariantu przy `variant.*`). */
function resolveAttr(
  attr: string,
  product: Product,
  variant: Variant | undefined,
  switchTypes: ReadonlyMap<string, string>,
): unknown {
  if (!isVariantAttr(attr)) return product.attributes[attr];
  if (!variant) return undefined;
  switch (attr) {
    case "variant.color":
      return variant.color;
    case "variant.price":
      return variant.price;
    case "variant.stock>0":
      return variant.stock > 0;
    case "variant.switch.type":
      return variant.switch === undefined ? undefined : switchTypes.get(variant.switch);
    case "variant.size":
      return variant.size;
    case "variant.size.type":
      return variant.size === undefined ? undefined : product.attributes.sizes?.[variant.size]?.type;
    default:
      return undefined;
  }
}

function matchesValue(
  def: FacetDef,
  value: FilterValue,
  raw: unknown,
): boolean {
  switch (def.type) {
    case "multi": {
      if (!Array.isArray(value) || raw === undefined || raw === null) return false;
      const have = (Array.isArray(raw) ? raw : [raw]).map((x) => String(x));
      return value.some((s) => have.includes(s));
    }
    case "bool":
      return value === true && raw === true;
    case "buckets": {
      if (!Array.isArray(value) || typeof raw !== "number") return false;
      return value.some((id) => {
        const b = def.values?.find((x) => x.v === id);
        return !!b && (b.min === undefined || raw >= b.min) && (b.max === undefined || raw <= b.max);
      });
    }
    case "range": {
      if (typeof value !== "object" || Array.isArray(value) || typeof raw !== "number") return false;
      return (value.min === null || raw >= value.min) && (value.max === null || raw <= value.max);
    }
    case "number-match": {
      if (typeof value !== "number" || !Array.isArray(raw) || raw.length !== 2) return false;
      const [min, max] = raw as [number, number];
      return min <= value && value <= max;
    }
    default:
      return false;
  }
}

function switchMap(ctx: FilterContext): Map<string, string> {
  return new Map(ctx.switches.map((s) => [s.id, s.type]));
}

/**
 * F-021: produkt pasuje, gdy spelnia wszystkie filtry produktowe i ISTNIEJE wariant spelniajacy
 * wszystkie filtry wariantowe naraz (LUB w obrebie filtra, I miedzy filtrami).
 */
function matchProduct(
  product: Product,
  active: { def: FacetDef; value: FilterValue }[],
  switchTypes: ReadonlyMap<string, string>,
): ListingItem | null {
  const productLevel = active.filter((a) => !isVariantAttr(a.def.attr));
  const variantLevel = active.filter((a) => isVariantAttr(a.def.attr));
  for (const { def, value } of productLevel) {
    if (!matchesValue(def, value, resolveAttr(def.attr, product, undefined, switchTypes))) return null;
  }
  const variants =
    variantLevel.length === 0
      ? product.variants
      : product.variants.filter((variant) =>
          variantLevel.every(({ def, value }) =>
            matchesValue(def, value, resolveAttr(def.attr, product, variant, switchTypes)),
          ),
        );
  if (variantLevel.length > 0 && variants.length === 0) return null;
  return { product, variants: [...variants], displayVariant: variants[0] };
}

function activeFilters(
  facets: readonly FacetDef[],
  state: FilterState,
  except?: string,
): { def: FacetDef; value: FilterValue }[] {
  const out: { def: FacetDef; value: FilterValue }[] = [];
  for (const def of facets) {
    if (def.id === except) continue;
    const value = state[def.id];
    if (value === undefined || value === false) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out.push({ def, value });
  }
  return out;
}

/** F-021: produkty spelniajace filtry (kolejnosc wejsciowa zachowana). */
export function filterProducts(
  products: readonly Product[],
  facets: readonly FacetDef[],
  state: FilterState,
  ctx: FilterContext,
): ListingItem[] {
  const active = activeFilters(facets, state);
  const switchTypes = switchMap(ctx);
  const out: ListingItem[] = [];
  for (const product of products) {
    const item = matchProduct(product, active, switchTypes);
    if (item) out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Facety i liczniki
// ---------------------------------------------------------------------------

function dynamicValues(
  def: FacetDef,
  products: readonly Product[],
  ctx: FilterContext,
  switchTypes: ReadonlyMap<string, string>,
): FacetValueDef[] {
  const found = new Set<string>();
  for (const p of products) {
    for (const variant of p.variants) {
      const raw = resolveAttr(def.attr, p, variant, switchTypes);
      if (raw !== undefined && raw !== null) found.add(String(raw));
    }
  }
  const colorOrder = Object.keys(ctx.colors);
  const ordered = [...found].sort((a, b) => {
    const ia = colorOrder.indexOf(a);
    const ib = colorOrder.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, "pl");
  });
  return ordered.map((v) => ({ v, label: ctx.colors[v]?.label ?? v }));
}

/**
 * F-021: facety z licznikami. Licznik przy wartosci = liczba produktow, ktore spelniaja pozostale
 * aktywne filtry i te wartosc (docs/04 par. 6). Wartosc z zerem jest `disabled`, chyba ze jest wybrana.
 */
export function computeFacets(
  products: readonly Product[],
  facets: readonly FacetDef[],
  state: FilterState,
  ctx: FilterContext,
): FacetResult[] {
  const switchTypes = switchMap(ctx);
  return facets.map((def): FacetResult => {
    const others = activeFilters(facets, state, def.id);
    const countWith = (value: FilterValue): number =>
      products.filter((p) => matchProduct(p, [...others, { def, value }], switchTypes) !== null).length;

    if (def.type === "bool") {
      return { id: def.id, label: def.label, type: def.type, values: [], count: countWith(true) };
    }
    if (def.type === "range") {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (const p of products) {
        for (const variant of p.variants) {
          const raw = resolveAttr(def.attr, p, variant, switchTypes);
          if (typeof raw === "number") {
            min = Math.min(min, raw);
            max = Math.max(max, raw);
          }
        }
      }
      const result: FacetResult = { id: def.id, label: def.label, type: def.type, values: [] };
      if (Number.isFinite(min)) result.bounds = { min, max };
      return result;
    }
    if (def.type === "number-match") {
      return { id: def.id, label: def.label, type: def.type, values: [] };
    }
    const defs = def.values ?? dynamicValues(def, products, ctx, switchTypes);
    const current = state[def.id];
    const selectedIds = Array.isArray(current) ? current : [];
    const values = defs.map((vd): FacetValueResult => {
      const count = countWith([vd.v]);
      const selected = selectedIds.includes(vd.v);
      const swatch = def.attr === "variant.color" ? ctx.colors[vd.v]?.swatch : undefined;
      return {
        v: vd.v,
        label: vd.label,
        count,
        selected,
        disabled: count === 0 && !selected,
        ...(swatch === undefined ? {} : { swatch }),
      };
    });
    return { id: def.id, label: def.label, type: def.type, values };
  });
}

// ---------------------------------------------------------------------------
// Sortowanie
// ---------------------------------------------------------------------------

export interface ListingPrice {
  price: Grosze;
  available: boolean;
}

/**
 * F-024 (docs/04 par. 5.1): cena listingu = najnizsza cena DOSTEPNEGO wariantu; gdy wszystkie bez stanu:
 * najnizsza cena i `available: false` (plakietka "Brak").
 */
export function listingPrice(variants: readonly Variant[]): ListingPrice | null {
  if (variants.length === 0) return null;
  const available = variants.filter((v) => v.stock > 0);
  const pool = available.length > 0 ? available : variants;
  return { price: Math.min(...pool.map((v) => v.price)), available: available.length > 0 };
}

function fitSum(product: Product): number {
  return Object.values(product.fit).reduce((a, b) => a + b, 0);
}

export interface SortOptions {
  /** Profil kreatora: sortowanie "Polecane" = fit[profil] malejaco, potem cena rosnaco (docs/03 par. 2). */
  profile?: string | null;
}

/**
 * F-024: sortowanie listingu. `polecane` bez profilu: dostepne przed niedostepnymi, plakietka bestseller,
 * suma fit, cena; z profilem (kreator): fit[profil] malejaco, cena rosnaco. Remis: kolejnosc wejsciowa.
 */
export function sortListing(
  items: readonly ListingItem[],
  sort: SortKey,
  options: SortOptions = {},
): ListingItem[] {
  const decorated = items.map((item, index) => {
    const lp = listingPrice(item.variants);
    return {
      item,
      index,
      price: lp?.price ?? Number.POSITIVE_INFINITY,
      available: lp?.available ?? false,
    };
  });
  type D = (typeof decorated)[number];
  const stable = (a: D, b: D): number => a.index - b.index;
  const profile = options.profile ?? null;

  const comparators: Record<SortKey, (a: D, b: D) => number> = {
    polecane: (a, b) => {
      if (profile !== null) {
        return (
          (b.item.product.fit[profile] ?? 0) - (a.item.product.fit[profile] ?? 0) ||
          a.price - b.price ||
          stable(a, b)
        );
      }
      return (
        Number(b.available) - Number(a.available) ||
        Number(b.item.product.badges.includes("bestseller")) -
          Number(a.item.product.badges.includes("bestseller")) ||
        fitSum(b.item.product) - fitSum(a.item.product) ||
        a.price - b.price ||
        stable(a, b)
      );
    },
    "cena-rosnaco": (a, b) => a.price - b.price || stable(a, b),
    "cena-malejaco": (a, b) => {
      const pa = Number.isFinite(a.price) ? a.price : Number.NEGATIVE_INFINITY;
      const pb = Number.isFinite(b.price) ? b.price : Number.NEGATIVE_INFINITY;
      return pb - pa || stable(a, b);
    },
    nowosci: (a, b) =>
      Number(b.item.product.badges.includes("nowosc")) -
        Number(a.item.product.badges.includes("nowosc")) || stable(a, b),
    najlzejsze: (a, b) => {
      const wa = a.item.product.attributes.weight_g;
      const wb = b.item.product.attributes.weight_g;
      return (
        (typeof wa === "number" ? wa : Number.POSITIVE_INFINITY) -
          (typeof wb === "number" ? wb : Number.POSITIVE_INFINITY) || stable(a, b)
      );
    },
  };
  return decorated.sort(comparators[sort]).map((d) => d.item);
}

// ---------------------------------------------------------------------------
// Adres (F-022) i zetony (F-023)
// ---------------------------------------------------------------------------

export interface ListingQuery {
  filters: FilterState;
  sort: SortKey;
  page: number;
}

export type ParamsRecord = Readonly<Record<string, string | undefined>>;

function parseNumber(text: string): number | null {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(n) ? n : null;
}

function parseMoneyRange(text: string): RangeValue | null {
  const idx = text.indexOf("-", text.startsWith("-") ? 1 : 0);
  if (idx < 0) return null;
  const left = text.slice(0, idx).trim();
  const right = text.slice(idx + 1).trim();
  const lo = left === "" ? null : parseNumber(left);
  const hi = right === "" ? null : parseNumber(right);
  if ((left !== "" && lo === null) || (right !== "" && hi === null)) return null;
  if (lo === null && hi === null) return null;
  const min = lo === null ? null : toGrosze(lo);
  const max = hi === null ? null : toGrosze(hi);
  if (min !== null && max !== null && min > max) return { min: max, max: min };
  return { min, max };
}

/** F-022: stan listingu z parametrow adresu (nieznane wartosci i bledne liczby sa pomijane). */
export function parseListingQuery(params: ParamsRecord, facets: readonly FacetDef[]): ListingQuery {
  const filters: FilterState = {};
  for (const def of facets) {
    const raw = params[def.id];
    if (raw === undefined || raw === "") continue;
    switch (def.type) {
      case "multi":
      case "buckets": {
        const parts = raw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "");
        const allowed = def.values?.map((v) => v.v);
        const picked = [...new Set(allowed ? parts.filter((p) => allowed.includes(p)) : parts)];
        if (picked.length > 0) filters[def.id] = picked;
        break;
      }
      case "bool":
        if (raw === "1") filters[def.id] = true;
        break;
      case "range": {
        const range = parseMoneyRange(raw);
        if (range) filters[def.id] = range;
        break;
      }
      case "number-match": {
        const n = parseNumber(raw);
        if (n !== null) filters[def.id] = n;
        break;
      }
      default:
        break;
    }
  }
  const sortRaw = params["sort"];
  const sort = SORT_KEYS.find((k) => k === sortRaw) ?? "polecane";
  const pageNum = Number(params["strona"]);
  const page = Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;
  return { filters, sort, page };
}

function groszeToZlText(gr: Grosze): string {
  const zl = Math.trunc(gr / 100);
  const rest = gr % 100;
  return rest === 0 ? String(zl) : `${zl}.${String(rest).padStart(2, "0").replace(/0$/, "")}`;
}

/** F-022: parametry adresu (kolejnosc: facety, sort, strona; wartosci domyslne pomijane). */
export function serializeListingQuery(
  query: ListingQuery,
  facets: readonly FacetDef[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of facets) {
    const value = query.filters[def.id];
    if (value === undefined || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) out[def.id] = value.join(",");
    } else if (typeof value === "boolean") {
      out[def.id] = "1";
    } else if (typeof value === "number") {
      out[def.id] = String(value);
    } else {
      out[def.id] = `${value.min === null ? "" : groszeToZlText(value.min)}-${value.max === null ? "" : groszeToZlText(value.max)}`;
    }
  }
  if (query.sort !== "polecane") out["sort"] = query.sort;
  if (query.page > 1) out["strona"] = String(query.page);
  return out;
}

export interface FilterChip {
  facetId: string;
  /** Wartosc do zdjecia dla multi/buckets; null dla pozostalych typow. */
  value: string | null;
  label: string;
}

function formatZl(gr: Grosze): string {
  return formatWithUnit(gr / 100, "zł", 2);
}

/** F-023: aktywne filtry jako zetony ("Rozmiar: 75%"). */
export function activeFilterChips(
  state: FilterState,
  facets: readonly FacetDef[],
  ctx: FilterContext,
): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const def of facets) {
    const value = state[def.id];
    if (value === undefined || value === false) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        const label = def.values?.find((x) => x.v === v)?.label ?? ctx.colors[v]?.label ?? v;
        chips.push({ facetId: def.id, value: v, label: `${def.label}: ${label}` });
      }
    } else if (typeof value === "boolean") {
      chips.push({ facetId: def.id, value: null, label: def.label });
    } else if (typeof value === "number") {
      chips.push({ facetId: def.id, value: null, label: `${def.label}: ${formatNumber(value, 1)}` });
    } else {
      const text =
        value.min !== null && value.max !== null
          ? `${formatZl(value.min)}–${formatZl(value.max)}`
          : value.min !== null
            ? `od ${formatZl(value.min)}`
            : `do ${formatZl(value.max ?? 0)}`;
      chips.push({ facetId: def.id, value: null, label: `${def.label}: ${text}` });
    }
  }
  return chips;
}

/** F-023: zdjecie jednego zetonu (nowy stan; wejscie bez zmian). */
export function removeChip(state: FilterState, chip: FilterChip): FilterState {
  const next: FilterState = { ...state };
  const value = next[chip.facetId];
  if (Array.isArray(value) && chip.value !== null) {
    const rest = value.filter((v) => v !== chip.value);
    if (rest.length > 0) next[chip.facetId] = rest;
    else delete next[chip.facetId];
  } else {
    delete next[chip.facetId];
  }
  return next;
}

// ---------------------------------------------------------------------------
// Zapytanie listingu
// ---------------------------------------------------------------------------

export interface ListingResult {
  items: ListingItem[];
  facets: FacetResult[];
  count: number;
  /** F-025: "12 produktów", "1 produkt" (Intl.PluralRules). */
  countLabel: string;
  chips: FilterChip[];
}

/** F-021, F-023, F-024, F-025: filtrowanie, sortowanie, facety z licznikami i etykieta liczby wynikow. */
export function queryListing(input: {
  products: readonly Product[];
  facets: readonly FacetDef[];
  query: Pick<ListingQuery, "filters" | "sort">;
  ctx: FilterContext;
  profile?: string | null;
}): ListingResult {
  const { products, facets, query, ctx } = input;
  const filtered = filterProducts(products, facets, query.filters, ctx);
  const items = sortListing(filtered, query.sort, { profile: input.profile ?? null });
  return {
    items,
    facets: computeFacets(products, facets, query.filters, ctx),
    count: items.length,
    countLabel: formatCount(items.length, PRODUCT_FORMS),
    chips: activeFilterChips(query.filters, facets, ctx),
  };
}
