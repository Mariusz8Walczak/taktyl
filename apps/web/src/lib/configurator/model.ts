// F-250, F-251 (ADR-0011): czysta logika widoku konfiguratora (bez three.js): id modelu, palety czesci, farby czesci,
// dopasowanie nadruku podkladki. Reguly walidacji i cen zostaja w @taktyl/domain i API.
import type { ConfiguratorData } from "@taktyl/contracts";
import type { ConfData, Configuration } from "@taktyl/domain";

type Model = ConfiguratorData["models"][number];
type Part = Model["parts"][number];
type Print = ConfiguratorData["prints"][number];

/** Id modelu 3D: klawiatury i myszki to id produktu, podkladki `<produkt>_<rozmiar>`. */
export function modelIdFor(productId: string, size: string | null | undefined): string {
  return productId.startsWith("p-") && size ? `${productId}_${size}` : productId;
}

export function findModelById(data: ConfiguratorData, id: string): Model | undefined {
  return data.models.find((m) => m.id === id);
}

/** Dane w ksztalcie oczekiwanym przez @taktyl/domain (doplat klient nie liczy, wiec pusta tabela). */
export function toDomainData(data: ConfiguratorData): ConfData {
  return {
    colors: data.colors,
    finishes: data.finishes,
    palettes: data.palettes,
    models: data.models as ConfData["models"],
    prints: data.prints,
    surcharges: { series: [], keyboards: {}, mice: {}, pads: {} },
  };
}

/** Czesci do wyboru, w kolejnosci z modelu. */
export function configurableParts(model: Model): Part[] {
  return model.parts.filter((p) => p.konfigurowalna && p.paleta);
}

/** Klucze kolorow palety (odwolanie `jak <paleta>` rozwijane rekurencyjnie). */
export function paletteColors(data: ConfiguratorData, key: string): string[] {
  const p = data.palettes[key];
  if (!p) return [];
  return typeof p.kolory === "string"
    ? paletteColors(data, p.kolory.replace(/^jak /, ""))
    : p.kolory;
}

/** Wykonczenia dozwolone dla czesci, z ograniczeniem technicznym: polprzezroczyste i jelly tylko z podswietleniem. */
export function allowedFinishes(data: ConfiguratorData, model: Model, part: Part): string[] {
  const palette = part.paleta ? data.palettes[part.paleta] : undefined;
  const hasBacklight = model.parts.some((p) => p.id === "podswietlenie");
  return (palette?.wykonczenia ?? []).filter(
    (f) => hasBacklight || !["polprzezroczyste", "akryl", "jelly"].includes(f),
  );
}

export interface PartPaint {
  color: string;
  pbr: Record<string, number | string | boolean | number[]>;
  emissive: boolean;
}

const MATTE = { roughness: 0.6, metalness: 0 } as const;

/** Farba czesci z rozwiazanej konfiguracji: kolor (swatch), parametry PBR wykonczenia, `emissive` dla podswietlenia. */
export function partPaint(
  data: ConfiguratorData,
  config: Configuration,
  partId: string,
): PartPaint | null {
  const choice = config.parts[partId];
  if (!choice) return null;
  const color = data.colors[choice.color]?.swatch;
  if (!color) return null;
  const finish = choice.finish ? data.finishes[choice.finish] : undefined;
  return { color, pbr: finish?.pbr ?? { ...MATTE }, emissive: partId === "podswietlenie" };
}

/** Wzor w skali 1:1 przycinany do podkladki (tryb `skala`) albo rozciagniety na calosc (README paczki). */
export function printMapping(
  print: Print,
  modelMm: readonly number[],
): { repeat: [number, number]; offset: [number, number] } {
  if (print.tryb !== "skala" || !print.mm) return { repeat: [1, 1], offset: [0, 0] };
  const sx = Math.min(1, (modelMm[0] ?? 1) / (print.mm[0] ?? 1));
  const sz = Math.min(1, (modelMm[1] ?? 1) / (print.mm[1] ?? 1));
  return { repeat: [sx, sz], offset: [(1 - sx) / 2, (1 - sz) / 2] };
}

/** Rodzina nadrukow pasujaca do modelu (nadruk ma liste `dla`). */
export function printsForModel(data: ConfiguratorData, model: Model): Print[] {
  return data.prints.filter((p) => p.dla.includes(model.product));
}

/** Czy model ma wybor nadruku na wierzchu (podkladki tkaninowe i hybrydowe). */
export function supportsPrints(data: ConfiguratorData, model: Model): boolean {
  return model.parts.some((p) => p.id === "wierzch") && printsForModel(data, model).length > 0;
}
