// F-250, audyt P0-3: model sekcji "Zaprojektuj klawiaturę" na stronie glownej. Czysta funkcja: dane konfiguratora
// i model kreatora -> trzy gotowe style. Style NIE sa nowymi produktami: to konfiguracje istniejacego modelu (Łupek 65)
// w kolorach serii z colors.json (grafit, mgła, kobalt), ktore sa tez wariantami produktu (render z manifestu jako
// zastepstwo 3D). Nazwa stylu = etykieta koloru z danych; SKU konfiguracji liczy @taktyl/domain (ten sam kod co API).
import type { ConfiguratorData } from "@taktyl/contracts";
import { configurationSku, resolveConfiguration, type Configuration } from "@taktyl/domain";
import type { ManifestEntry } from "@taktyl/ui";
import { packshotEntry, type BuilderModel } from "../builder/catalog";
import { findModelById, toDomainData } from "../configurator/model";

/** Model w sekcji: bestseller z karty "Polecane"; zmiana tutaj nie wymaga zmian w danych. */
export const DESIGN_MODEL_ID = "k-lupek-65";
/** Kolory serii (docs/06 §1: kolory produktow powtarzaja palete strony). */
const SERIES = ["grafit", "mgla", "kobalt"] as const;

export interface DesignStyle {
  id: string;
  label: string;
  /** Probki z colors.json -> swatch (wyjatek reguly 2): obudowa, klawisze, akcent. */
  swatches: string[];
  parts: Configuration["parts"];
  /** Adres konfiguratora z ta konfiguracja (stan w `?sku=`, F-252). */
  href: string;
  image: ManifestEntry;
}

export interface DesignSection {
  modelId: string;
  productName: string;
  productHref: string;
  styles: DesignStyle[];
}

export function buildDesignSection(
  data: ConfiguratorData,
  builder: BuilderModel,
): DesignSection | null {
  const model = findModelById(data, DESIGN_MODEL_ID);
  const product = builder.byId.get(DESIGN_MODEL_ID);
  if (!model || !product) return null;
  const domain = toDomainData(data);
  const styles: DesignStyle[] = [];
  for (const color of SERIES) {
    const variant = product.variants.find((v) => v.color === color && v.status === "active");
    if (!variant || !data.colors[color]) continue;
    // Akcent (Esc, Enter): kobalt, a w stylu kobaltowym mgla, zeby byl widoczny na klawiszach
    const accent = color === "kobalt" ? "mgla" : "kobalt";
    const parts: Configuration["parts"] = {
      obudowa: { color, finish: "mat" },
      klawisze_alfa: { color, finish: "pbt" },
      klawisze_mod: { color, finish: "pbt" },
      klawisze_akcent: { color: accent, finish: "pbt" },
    };
    const known = Object.keys(parts).every((id) => model.parts.some((p) => p.id === id));
    if (!known) continue;
    const resolved = resolveConfiguration(domain, { model: model.id, parts, print: null });
    if (resolved.issues.length > 0) continue;
    styles.push({
      id: color,
      label: data.colors[color]!.label,
      swatches: [color, accent].map((c) => data.colors[c]?.swatch ?? "").filter(Boolean),
      parts,
      href: `/konfigurator/${model.id}?sku=${encodeURIComponent(configurationSku(domain, resolved.config))}`,
      image: packshotEntry(product, variant),
    });
  }
  if (styles.length === 0) return null;
  return {
    modelId: model.id,
    productName: product.name,
    productHref: `/klawiatury/${product.slug}`,
    styles,
  };
}
