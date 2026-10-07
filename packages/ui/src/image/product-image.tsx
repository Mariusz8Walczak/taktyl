import type { CSSProperties } from "react";
import { cx } from "../lib/cx.js";
import {
  buildSrcSet,
  fallbackSrc,
  intrinsicSize,
  packshotAlt,
  topdownCaption,
} from "./manifest.js";
import type { ManifestEntry } from "./manifest.js";

export interface ProductImageProps {
  entry: ManifestEntry;
  /** Prefiks adresow plikow z manifestu (domyslnie "/"; np. adres CDN). */
  baseUrl?: string;
  /** Nazwa produktu: tekst alternatywny i podpisy placeholderow. */
  productName: string;
  /** Nazwa koloru wariantu (np. "Grafit"). */
  colorName: string;
  /** Kolor probki z data/colors.json -> swatch; wymagany dla placeholdera tekstury. */
  swatch?: string;
  /** Wymiary maty w mm (placeholder tekstury); domyslnie kafel tile_mm. */
  matMm?: { w: number; d: number };
  /** Atrybut sizes dla packshotu (domyslnie 100vw). */
  sizes?: string;
  /** Nadpisuje tekst alternatywny. */
  alt?: string;
  /** alt="" (miniatury galerii, elementy podgladu biurka). Domyslnie true dla topdown i texture. */
  decorative?: boolean;
  /** Pierwszy ekran: fetchpriority=high i loading=eager (docs/11 pkt 16); inaczej loading=lazy. */
  priority?: boolean;
  /** Podpis placeholdera wycinka z gory; false, gdy po przeskalowaniu placeholder jest za maly (docs/03 §5.3). */
  showCaption?: boolean;
  className?: string;
}

const W_PRZYGOTOWANIU = "zdjęcie w przygotowaniu";

/**
 * Obraz produktu z manifestu (TAKTYL-26, docs/09 §3-5).
 * status "gotowe": <img> z srcset, width, height i alt; status "brak": placeholder o tych samych
 * wymiarach i proporcjach (CLS = 0 przy podmianie): packshot kwadrat, topdown prostokat dims_mm
 * (plotno 1 px = 1 mm), texture wypelniona kolorem probki. Placeholder niczego nie udaje.
 */
export function ProductImage({
  entry,
  baseUrl = "/",
  productName,
  colorName,
  swatch,
  matMm,
  sizes = "100vw",
  alt,
  decorative,
  priority = false,
  showCaption = true,
  className,
}: ProductImageProps) {
  const isPackshot = entry.kind === "packshot";
  const isDecorative = decorative ?? !isPackshot;
  const resolvedAlt = isDecorative
    ? ""
    : (alt ?? packshotAlt(productName, colorName, entry.description));
  const { width, height } = intrinsicSize(entry);

  // Wymiary plotna (mm) dla topdown i texture: jedna zmienna, wspolna dla zdjecia i placeholdera.
  const mm =
    entry.kind === "topdown"
      ? (entry.dims_mm ?? { w: width, d: height })
      : (matMm ?? { w: entry.tile_mm ?? width, d: entry.tile_mm ?? height });
  const style: CSSProperties | undefined = isPackshot
    ? undefined
    : ({
        "--tk-w": mm.w,
        "--tk-d": mm.d,
        ...(entry.kind === "texture" && swatch ? { "--tk-swatch": swatch } : {}),
      } as CSSProperties);
  const klasa = cx("tk-obraz", `tk-obraz--${entry.kind}`, className);

  if (entry.status === "gotowe") {
    const src = fallbackSrc(entry, baseUrl);
    if (src) {
      return (
        <img
          className={klasa}
          style={style}
          src={src}
          srcSet={buildSrcSet(entry, baseUrl)}
          sizes={isPackshot ? sizes : undefined}
          width={width}
          height={height}
          alt={resolvedAlt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
        />
      );
    }
  }

  const label = isDecorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": `${resolvedAlt}, ${W_PRZYGOTOWANIU}` };

  return (
    <div {...label} className={cx(klasa, "tk-obraz--placeholder")} style={style} data-status="brak">
      {entry.kind === "packshot" ? (
        <>
          <span className="tk-obraz__linia">{productName}</span>
          <span className="tk-obraz__linia">{colorName}</span>
          <span className="tk-obraz__brak">{W_PRZYGOTOWANIU}</span>
        </>
      ) : null}
      {entry.kind === "topdown" && showCaption ? (
        <span className="tk-obraz__linia">{topdownCaption(productName, mm)}</span>
      ) : null}
    </div>
  );
}

/** Nazwa z docs/09: komponent obrazu. */
export { ProductImage as Picture };
