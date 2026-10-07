/** Typy zgodne z assets/manifest.json (docs/09 §3). Komponent obrazu czyta wpis, nie zgaduje sciezek. */
export type ManifestKind = "packshot" | "topdown" | "texture";
export type ManifestStatus = "gotowe" | "brak";

export interface ManifestEntry {
  key: string;
  product_id?: string;
  color?: string;
  size?: string | null;
  kind: ManifestKind;
  /** Tylko packshot: ujecie (01-34, 02-gora, 03-bok, 04-detal). */
  shot?: string;
  /** Opis ujecia do tekstu alternatywnego, np. "ujęcie 3/4 z przodu". */
  description?: string;
  ratio?: string;
  /** Tylko topdown: wymiary produktu w mm (1 px = 1 mm w plotnie podgladu). */
  dims_mm?: { w: number; d: number };
  /** Tylko texture: bok kafla w mm. */
  tile_mm?: number;
  scale?: string;
  /** packshot: -400/-800/-1600.webp; topdown i texture: @1x/@2x.webp. */
  files: readonly string[];
  /** topdown i texture: wymiary plikow w px dla 1x i 2x. */
  pixels?: Partial<Record<"1x" | "2x", readonly [number, number]>>;
  priority?: "P0" | "P1" | "P2";
  status: ManifestStatus;
}

export function findManifestEntry(
  manifest: readonly ManifestEntry[],
  key: string,
): ManifestEntry | undefined {
  return manifest.find((e) => e.key === key);
}

function join(baseUrl: string, file: string): string {
  return baseUrl.endsWith("/") ? baseUrl + file : `${baseUrl}/${file}`;
}

/** Szerokosc z nazwy pliku packshotu ("...-800.webp" -> 800). */
function widthOf(file: string): number | null {
  const m = /-(\d+)\.webp$/.exec(file);
  return m ? Number(m[1]) : null;
}

/** Gestosc z nazwy pliku ("...@2x.webp" -> "2x"). */
function densityOf(file: string): string | null {
  const m = /@(\d+x)\.webp$/.exec(file);
  return m ? (m[1] ?? null) : null;
}

/** srcset z wpisu: packshot po szerokosciach (w), topdown i texture po gestosci (x). */
export function buildSrcSet(entry: ManifestEntry, baseUrl = "/"): string | undefined {
  const parts = entry.files.flatMap((file) => {
    const d = entry.kind === "packshot" ? widthOf(file) : densityOf(file);
    if (d === null) return [];
    return [`${join(baseUrl, file)} ${entry.kind === "packshot" ? `${d}w` : d}`];
  });
  return parts.length ? parts.join(", ") : undefined;
}

/** Wymiary wlasne obrazu w px (do atrybutow width i height): packshot 1:1 po najszerszym pliku. */
export function intrinsicSize(entry: ManifestEntry): { width: number; height: number } {
  if (entry.kind === "packshot") {
    const widest = Math.max(...entry.files.map((f) => widthOf(f) ?? 0), 0);
    const w = widest || 800;
    return { width: w, height: w };
  }
  const px = entry.pixels?.["1x"];
  if (px) return { width: px[0], height: px[1] };
  const mm = entry.kind === "topdown" ? entry.dims_mm : undefined;
  if (mm) return { width: mm.w, height: mm.d };
  const tile = entry.tile_mm ?? 200;
  return { width: tile, height: tile };
}

/** Plik do atrybutu src: najwiekszy dostepny. */
export function fallbackSrc(entry: ManifestEntry, baseUrl = "/"): string | undefined {
  const sorted = [...entry.files].sort((a, b) => (widthOf(a) ?? 0) - (widthOf(b) ?? 0));
  const last = entry.kind === "packshot" ? sorted[sorted.length - 1] : entry.files[0];
  return last ? join(baseUrl, last) : undefined;
}

const cm = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });

/** Podpis placeholdera wycinka z gory: "Bazalt 75 · 32,7 × 14 cm" (docs/03 §5.3). */
export function topdownCaption(productName: string, dims: { w: number; d: number }): string {
  return `${productName} · ${cm.format(dims.w / 10)} × ${cm.format(dims.d / 10)} cm`;
}

/** Tekst alternatywny ujecia produktowego wg docs/09 §4.4: "{nazwa} w kolorze {kolor}, {opis ujecia}". */
export function packshotAlt(productName: string, colorName: string, description?: string): string {
  const base = `${productName} w kolorze ${colorName}`;
  return description ? `${base}, ${description}` : base;
}
