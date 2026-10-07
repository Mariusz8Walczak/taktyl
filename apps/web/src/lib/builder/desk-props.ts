// F-106 (docs/03 §5): wlasciwosci DeskStage z modelu kreatora i analizy setu. Wspolne dla podgladu w kreatorze
// (DeskView) i pierwszego ekranu strony glownej (TAKTYL-37). Czysta funkcja: dane serializowalne, bez DOM.
import { mouseZoneMm } from "@taktyl/domain";
import type { DeskStageProps } from "@taktyl/ui";
import { attrs, colorLabel, textureEntry, topdownEntry } from "./catalog";
import type { BuilderModel, BuilderProduct } from "./catalog";
import type { Analysis } from "./fit";

export type DeskStageData = Pick<
  DeskStageProps,
  "keyboard" | "mouse" | "pad" | "zoneMm" | "gapMm" | "marginMm" | "result"
>;

export function deskStageData(
  model: BuilderModel,
  profile: string | null,
  analysis: Pick<Analysis, "entries" | "deskResult">,
): DeskStageData {
  const { k, m, p } = analysis.entries;
  const bp = (e: { product: { id: string } } | null): BuilderProduct | null =>
    e ? (model.byId.get(e.product.id) ?? null) : null;
  const kp = bp(k);
  const mp = bp(m);
  const pp = bp(p);
  const swatch = (color: string) => model.colors.find((c) => c.id === color)?.swatch ?? "";
  const padSize = p && pp ? attrs(pp).sizes?.[p.variant.size ?? ""] : undefined;
  return {
    zoneMm: mouseZoneMm(profile, model.rules),
    gapMm: model.rules.gap_keyboard_mouse_mm,
    marginMm: model.rules.edge_margin_mm,
    result: analysis.deskResult,
    keyboard:
      k && kp
        ? {
            name: kp.name,
            colorName: colorLabel(model, k.variant.color),
            dimsMm: {
              w: k.product.attributes.dims_mm?.w ?? 0,
              d: k.product.attributes.dims_mm?.d ?? 0,
            },
            entry: topdownEntry(kp, k.variant.color),
          }
        : null,
    mouse:
      m && mp
        ? {
            name: mp.name,
            colorName: colorLabel(model, m.variant.color),
            dimsMm: {
              w: m.product.attributes.dims_mm?.w ?? 0,
              d: m.product.attributes.dims_mm?.d ?? 0,
            },
            entry: topdownEntry(mp, m.variant.color),
          }
        : null,
    pad:
      p && pp && padSize
        ? {
            name: pp.name,
            sizeLabel: padSize.label,
            colorName: colorLabel(model, p.variant.color),
            sizeMm: { w: padSize.w, d: padSize.d, type: padSize.type },
            entry: textureEntry(pp, p.variant.color),
            swatch: swatch(p.variant.color),
          }
        : null,
  };
}
