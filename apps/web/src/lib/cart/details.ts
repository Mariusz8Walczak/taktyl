// F-150, F-151, F-256 (audyt P1-4): opis pozycji koszyka po ludzku - miniatura (render 01-34 z manifestu), nazwa
// wariantu ("Grafit · Ślizg", "Puszczyk") zamiast SKU, a dla konfiguracji wlasnej lista czesci ("Obudowa: Grafit, mat")
// i probki kolorow (colors.json -> swatch). Czysta funkcja na danych kreatora i konfiguratora (serwer); ceny NIE -
// cena pozycji zawsze z wyceny API (F-157, ADR-0007).
import type { ConfiguratorData } from "@taktyl/contracts";
import { parseConfigurationSku } from "@taktyl/domain";
import type { ManifestEntry } from "@taktyl/ui";
import { packshotEntry, variantText, type BuilderModel } from "../builder/catalog";
import { findModelById, toDomainData } from "../configurator/model";

export interface CartPartLine {
  label: string;
  /** "Grafit, mat" */
  value: string;
  swatch: string | null;
}

export interface CartSkuDetails {
  sku: string;
  productName: string;
  /** "Grafit · Ślizg"; konfiguracja: "Konfiguracja własna". */
  variant: string;
  colorName: string;
  /** Karta produktu (z ?sku= dla gotowego wariantu). */
  href: string | null;
  /** Render 01-34 gotowego wariantu; konfiguracja wlasna nie ma renderu (sa probki). */
  image: ManifestEntry | null;
  /** Tylko konfiguracja wlasna: czesci w kolejnosci z modelu. */
  parts: CartPartLine[] | null;
}

const CATEGORY_PATH: Record<string, string> = { K: "klawiatury", M: "myszki", P: "podkladki" };

export function cartSkuDetails(
  skus: readonly string[],
  model: BuilderModel,
  configurator: ConfiguratorData | null,
): Record<string, CartSkuDetails> {
  const out: Record<string, CartSkuDetails> = {};
  const domain = configurator ? toDomainData(configurator) : null;
  for (const sku of skus) {
    const found = model.bySku.get(sku);
    if (found) {
      const { product, variant } = found;
      const image = packshotEntry(product, variant);
      out[sku] = {
        sku,
        productName: product.name,
        variant: variantText(model, product, variant),
        colorName: model.colors.find((c) => c.id === variant.color)?.label ?? variant.color,
        href: `/${product.category}/${product.slug}?sku=${encodeURIComponent(sku)}`,
        image: image.status === "gotowe" ? image : null,
        parts: null,
      };
      continue;
    }
    if (!configurator || !domain || !sku.includes("-CFG-")) continue;
    const config = parseConfigurationSku(domain, sku);
    const cm = config ? findModelById(configurator, config.model) : undefined;
    if (!config || !cm) continue;
    const product = model.byId.get(cm.product);
    const parts: CartPartLine[] = cm.parts
      .filter((p) => p.konfigurowalna && p.paleta && config.parts[p.id])
      .map((p) => {
        const choice = config.parts[p.id]!;
        const color = configurator.colors[choice.color];
        const finish = choice.finish ? configurator.finishes[choice.finish]?.label : null;
        const print =
          p.id === "wierzch" && config.print
            ? configurator.prints.find((x) => x.id === config.print)
            : undefined;
        return {
          label: p.etykieta,
          value: print
            ? `nadruk ${print.nazwa}`
            : [color?.label ?? choice.color, finish].filter(Boolean).join(", "),
          swatch: print ? null : (color?.swatch ?? null),
        };
      });
    if (config.switch) {
      const sw = configurator.switches[config.switch];
      if (sw) parts.push({ label: "Przełącznik", value: sw.name, swatch: null });
    }
    const name = cm.size ? `${cm.name} ${cm.size.toUpperCase()}` : cm.name;
    out[sku] = {
      sku,
      productName: name,
      variant: "Konfiguracja własna",
      colorName: parts[0]?.value ?? "",
      href: product
        ? `/${CATEGORY_PATH[sku.charAt(0)] ?? product.category}/${product.slug}`
        : null,
      image: null,
      parts,
    };
  }
  return out;
}
