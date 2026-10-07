// F-001..F-009 (docs/05 §2, strona glowna, TAKTYL-37): modele widoku sekcji strony glownej. Czyste funkcje bez I/O:
// dane z API (kategorie, sety, model kreatora, ustawienia) -> to, co renderuja komponenty. Liczby (zapas, wymagana
// szerokosc, sumy setow) pochodza z @taktyl/domain i danych, nie sa wpisane w tekstach (docs/01 §2.3).
import type { Category } from "@taktyl/contracts";
import { formatCount, formatMmAsCm, formatPLN, type PluralForms } from "@taktyl/domain";
import type { ManifestEntry } from "@taktyl/ui";
import {
  attrs,
  packshotEntry,
  colorLabel,
  variantText,
  type BuilderModel,
  type BuilderProduct,
} from "../builder/catalog";
import { deskStageData, type DeskStageData } from "../builder/desk-props";
import { analyze, padMargin } from "../builder/fit";
import { EMPTY_STATE } from "../builder/types";
import { buildItem } from "../track-items";
import type { TrackItem } from "../track-events";

/** Zestaw z hero (docs/05 §2 pkt 3): gotowy set "Programista". */
export const HERO_PRESET_ID = "programista";

/** Przyklad z docs/01 §2.3 (dowod bez zmyslania): produkty i profil, liczby wylicza `buildSetExample`. */
export const EXAMPLE = {
  keyboardSlug: "marmur-100",
  mouseSlug: "jerzyk",
  padSlug: "szron",
  padSize: "xl",
  profile: "fps",
} as const;

export const LIST_PRESETS = { id: "gotowe-sety", name: "Gotowe sety" } as const;
export const LIST_FEATURED = { id: "polecane", name: "Polecane" } as const;

/** Ile polecanych z kazdej kategorii (docs/05 §2 pkt 7: po 2-3, razem 8). */
export const FEATURED_PER_CATEGORY = { klawiatury: 3, myszki: 3, podkladki: 2 } as const;

const MODEL_FORMS: PluralForms = { one: "model", few: "modele", many: "modeli" };

// ---- adresy kreatora ----

export const BUILDER_HERO_HREF = "/zbuduj-set?wejscie=hero";

export function presetHref(id: string): string {
  return `/zbuduj-set?preset=${encodeURIComponent(id)}&wejscie=preset`;
}

// ---- kafle kategorii ----

export interface CategoryTile {
  id: string;
  slug: string;
  name: string;
  href: string;
  /** "6 modeli · od 299,00 zł" - liczby z API (`model_count`, `from_price_gr`). */
  summary: string;
  image: { entry: ManifestEntry; productName: string; colorName: string } | null;
}

export function buildCategoryTiles(
  categories: readonly Category[],
  model: BuilderModel,
): CategoryTile[] {
  return [...categories]
    .sort((a, b) => a.position - b.position)
    .map((c) => {
      const product = model.products.find((p) => p.category === c.id);
      const variant =
        product?.variants.find((v) => v.sku === product.default_variant_sku) ??
        product?.variants[0];
      const parts = [formatCount(c.model_count, MODEL_FORMS)];
      if (c.from_price_gr !== null) parts.push(`od ${formatPLN(c.from_price_gr)}`);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        href: `/${c.slug}`,
        summary: parts.join(" · "),
        image:
          product && variant
            ? {
                entry: packshotEntry(product, variant),
                productName: product.name,
                colorName: colorLabel(model, variant.color),
              }
            : null,
      };
    });
}

// ---- gotowe sety ----

export interface PresetCardItem {
  sku: string;
  productName: string;
  variantLabel: string;
  colorName: string;
  entry: ManifestEntry;
}

export interface PresetCard {
  id: string;
  name: string;
  note: string;
  href: string;
  items: PresetCardItem[];
  /** "Razem 1203,30 zł · oszczędzasz 133,70 zł" */
  totalText: string;
  trackItems: TrackItem[];
}

export function buildPresetCards(model: BuilderModel): PresetCard[] {
  return model.presets.map((preset) => {
    const items: PresetCardItem[] = [];
    const trackItems: TrackItem[] = [];
    preset.skus.forEach((sku, index) => {
      const hit = model.bySku.get(sku);
      if (!hit) return;
      items.push({
        sku,
        productName: hit.product.name,
        variantLabel: variantText(model, hit.product, hit.variant),
        colorName: colorLabel(model, hit.variant.color),
        entry: packshotEntry(hit.product, hit.variant),
      });
      trackItems.push(
        buildItem({
          sku,
          name: hit.product.name,
          category: hit.product.category,
          variant: variantText(model, hit.product, hit.variant),
          priceGr: hit.variant.price_gr,
          listId: LIST_PRESETS.id,
          listName: LIST_PRESETS.name,
          index,
        }),
      );
    });
    return {
      id: preset.id,
      name: preset.name,
      note: preset.note,
      href: presetHref(preset.id),
      items,
      totalText: `Razem ${formatPLN(preset.total_gr)} · oszczędzasz ${formatPLN(preset.set_discount_gr)}`,
      trackItems,
    };
  });
}

// ---- hero: DeskStage z gotowym setem ----

export interface HeroDeskView {
  presetId: string;
  data: DeskStageData;
}

export function buildHeroDesk(model: BuilderModel): HeroDeskView | null {
  const preset = model.presets.find((p) => p.id === HERO_PRESET_ID) ?? model.presets[0];
  if (!preset) return null;
  const [k, m, p] = preset.skus;
  const state = {
    ...EMPTY_STATE,
    profile: preset.profile,
    k: k ?? null,
    m: m ?? null,
    p: p ?? null,
  };
  const analysis = analyze(model, state);
  if (!analysis.entries.k || !analysis.entries.m || !analysis.entries.p) return null;
  return { presetId: preset.id, data: deskStageData(model, preset.profile, analysis) };
}

// ---- "Jak dziala set": przyklad z liczbami (docs/01 §2.3) ----

export interface SetExample {
  keyboardName: string;
  keyboardWidth: string;
  profileLabel: string;
  zone: string;
  required: string;
  padLabel: string;
  padWidth: string;
  /** Rozmiar proponowanej podkladki ("XXL") i pelny tekst przycisku propozycji. */
  suggestionSize: string | null;
  suggestionLabel: string | null;
}

function productBySlug(model: BuilderModel, slug: string): BuilderProduct | undefined {
  return model.products.find((p) => p.slug === slug);
}

/**
 * Przyklad za waski o 1 cm: Marmur 100 + Jerzyk + Szron XL, profil FPS. Zwraca null, gdy dane nie pasuja
 * (brak produktu albo set sie miesci) - sekcja pokazuje wtedy sam opis krokow, bez wymyslonych liczb.
 */
export function buildSetExample(model: BuilderModel): SetExample | null {
  const keyboard = productBySlug(model, EXAMPLE.keyboardSlug);
  const mouse = productBySlug(model, EXAMPLE.mouseSlug);
  const pad = productBySlug(model, EXAMPLE.padSlug);
  if (!keyboard || !mouse || !pad) return null;
  const padVariant = pad.variants.find((v) => v.size === EXAMPLE.padSize && v.stock > 0);
  if (!padVariant) return null;
  const analysis = analyze(model, {
    ...EMPTY_STATE,
    profile: EXAMPLE.profile,
    k: keyboard.default_variant_sku,
    m: mouse.default_variant_sku,
    p: padVariant.sku,
  });
  const verdict = analysis.report.results.find((r) => r.id === "pad-width-desk");
  const kbDims = attrs(keyboard).dims_mm;
  const padSize = attrs(pad).sizes?.[EXAMPLE.padSize];
  const profile = model.rules.profiles[EXAMPLE.profile];
  if (!verdict || verdict.level !== "uwaga" || !kbDims || !padSize || !profile) return null;
  const diff = padMargin(model, EXAMPLE.profile, kbDims.w, padSize);
  if (diff === null) return null;
  const suggested = verdict.suggestion ? model.index.get(verdict.suggestion.sku) : undefined;
  const suggestedSize = suggested?.variant.size;
  return {
    keyboardName: keyboard.name,
    keyboardWidth: formatMmAsCm(kbDims.w),
    profileLabel: profile.label,
    zone: formatMmAsCm(profile.mouse_zone_mm),
    required: formatMmAsCm(padSize.w - diff),
    padLabel: padSize.label,
    padWidth: formatMmAsCm(padSize.w),
    suggestionSize:
      suggested && suggestedSize
        ? (suggested.product.attributes.sizes?.[suggestedSize]?.label ??
          suggestedSize.toUpperCase())
        : null,
    suggestionLabel: verdict.suggestion?.label ?? null,
  };
}

/** Zdanie z przykladem (docs/01 §2.3), skladane z policzonych wartosci. */
export function exampleSentences(ex: SetExample): string[] {
  const out = [
    `${ex.keyboardName} ma ${ex.keyboardWidth} szerokości.`,
    `Przy profilu „${ex.profileLabel}” mysz potrzebuje około ${ex.zone} na ruch.`,
    `Z odstępami to ${ex.required}, a mata ${ex.padLabel} ma ${ex.padWidth}.`,
  ];
  out.push(
    ex.suggestionSize
      ? `Kreator to wyłapie i zaproponuje ${ex.suggestionSize}.`
      : "Kreator to wyłapie i pokaże, co zmienić.",
  );
  return out;
}
