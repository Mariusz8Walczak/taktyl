// F-106 DeskStage (docs/03 §5), wzorzec "kreator: podglad" - brak odpowiednika w szablonie (docs/08 §6), wlasny
// komponent z tokenow. A-02 (docs/07 §3.2): klasy scena__mata/klawiatura/myszka/strefa/wynik, klase scena-start
// dodaje wyspa apps/web (raz na sesje). A-06: zmiana elementu setu przez warstwy (use-swap.ts), ruch w css/scena.css.
// Nic nie jest rysowane: zdjecia z manifestu albo placeholdery w wymiarach z danych.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ProductImage } from "../image/product-image.js";
import { buildSrcSet } from "../image/manifest.js";
import type { ManifestEntry } from "../image/manifest.js";
import { cx } from "../lib/cx.js";
import { computeDeskGeometry } from "./geometry.js";
import { useSwapLayers } from "./use-swap.js";
import type { SwapLayer, SwapSnapshot } from "./use-swap.js";
import type { PadType, Rect, SizeMm } from "./geometry.js";
import { composeDeskLabel, resultBadgeText, zoneCaption } from "./labels.js";
import type { DeskResult } from "./labels.js";

export interface DeskKeyboard {
  name: string;
  colorName: string;
  dimsMm: SizeMm;
  /** Wpis manifestu kind "topdown". */
  entry: ManifestEntry;
}
export type DeskMouse = DeskKeyboard;

export interface DeskPad {
  /** Nazwa modelu ("Szron"). */
  name: string;
  /** Etykieta rozmiaru ("XL"). */
  sizeLabel: string;
  colorName: string;
  /** sizes[variant.size]: w, d, type. */
  sizeMm: SizeMm & { type: PadType };
  /** Wpis manifestu kind "texture". */
  entry: ManifestEntry;
  /** colors.json -> swatch (placeholder tekstury). */
  swatch: string;
}

export interface DeskStageProps {
  keyboard?: DeskKeyboard | null;
  mouse?: DeskMouse | null;
  pad?: DeskPad | null;
  /** Strefa ruchu myszki w mm (profil albo no_profile z rules.json). */
  zoneMm: number;
  /** gap_keyboard_mouse_mm i edge_margin_mm z rules.json. */
  gapMm: number;
  marginMm: number;
  /** Wynik reguly szerokosci; null = bez zdania o zapasie. */
  result?: DeskResult | null;
  /** Wariant telefonu: wysokosc <= 30% ekranu. */
  compact?: boolean;
  baseUrl?: string;
  /** Pierwszy ekran: zdjecia eager + fetchpriority high. */
  priority?: boolean;
  /** Skala startowa do SSR (przed pomiarem); wplywa tylko na widocznosc podpisow, nie na uklad. */
  initialScale?: number;
  /** Tekst zastepczy podkladki w ukladzie "brak podkladki". */
  padHint?: string;
  className?: string;
}

/** Najmniejszy bok placeholdera po przeskalowaniu, od ktorego pokazujemy podpis (docs/03 §5.3). */
export const MIN_CAPTION_PX = 80;
const PAD_HINT = "Tu będzie podkładka (XL: 90 × 40 cm)";

function rectVars(r: Rect): CSSProperties {
  return { "--x": r.x, "--y": r.y, "--w": r.w, "--d": r.d } as CSSProperties;
}

/** image-set z plikow @1x/@2x wpisu tekstury (tlo maty, docs/03 §5.2). */
function textureBackground(entry: ManifestEntry, baseUrl: string): string | undefined {
  const set = buildSrcSet(entry, baseUrl);
  if (!set) return undefined;
  const parts = set.split(", ").map((p) => {
    const [url, density] = p.split(" ");
    return `url("${url}") ${density}`;
  });
  return `image-set(${parts.join(", ")})`;
}

function useScale(initial: number, canvasW: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0 && canvasW > 0) setScale(w / canvasW);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasW]);
  return { ref, scale, effective: scale ?? initial };
}

/**
 * F-106: podglad biurka w skali. Plotno 1 px = 1 mm skalowane `transform: scale(var(--s))`; kontener rezerwuje
 * wysokosc przez aspect-ratio (CLS 0 takze przed hydracja: --s liczy CSS z container query, ResizeObserver tylko
 * dokleja te sama wartosc liczbowa do decyzji o podpisach). Dostepnosc: role="img" + aria-label z danych.
 */
export function DeskStage({
  keyboard = null,
  mouse = null,
  pad = null,
  zoneMm,
  gapMm,
  marginMm,
  result = null,
  compact = false,
  baseUrl = "/",
  priority = false,
  initialScale = 0.5,
  padHint = PAD_HINT,
  className,
}: DeskStageProps) {
  const g = computeDeskGeometry({
    keyboard: keyboard?.dimsMm ?? null,
    mouse: mouse?.dimsMm ?? null,
    pad: pad?.sizeMm ?? null,
    zoneMm,
    gapMm,
    marginMm,
  });
  const { ref, scale, effective } = useScale(initialScale, g.canvas.w);
  const fits = (r: Rect) => r.w * effective >= MIN_CAPTION_PX && r.d * effective >= MIN_CAPTION_PX;
  const uwaga = result?.status === "uwaga";
  const label = composeDeskLabel({
    keyboardName: keyboard?.name ?? null,
    mouseName: mouse?.name ?? null,
    pad: pad ? { name: pad.name, sizeLabel: pad.sizeLabel, type: pad.sizeMm.type } : null,
    result,
  });
  const style = {
    "--tk-sc-w": g.canvas.w,
    "--tk-sc-d": g.canvas.d,
  } as CSSProperties;
  const canvasStyle = (scale === null ? undefined : { "--s": scale }) as CSSProperties | undefined;
  const snap = <T extends { entry: ManifestEntry }>(
    item: T | null | undefined,
    rect: Rect | null | undefined,
    extra = "",
  ): SwapSnapshot<T, Rect> | null =>
    item && rect ? { key: `${item.entry.key}${extra}`, item, rect } : null;
  // A-06: kazdy slot ma wlasne warstwy (wychodzaca + biezaca); pierwszy render i reduced-motion bez ruchu.
  const padLayers = useSwapLayers(snap(pad, g.pad, pad ? `|${pad.sizeLabel}` : ""));
  const keyboardLayers = useSwapLayers(snap(keyboard, g.keyboard));
  const mouseLayers = useSwapLayers(snap(mouse, g.mouse));
  const phaseClass = (l: SwapLayer<unknown, Rect>) =>
    l.phase === "idle" ? undefined : `is-${l.phase}`;
  const hasPadLayer = padLayers.length > 0;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={cx(
        "tk-scena",
        `tk-scena--${g.layout}`,
        compact && "tk-scena--kompakt",
        uwaga && "tk-scena--uwaga",
        className,
      )}
      data-layout={g.layout}
      style={style}
    >
      <div className="tk-scena__platno scena__platno" style={canvasStyle}>
        {padLayers.map((l) => {
          const padBg =
            l.item.entry.status === "gotowe" ? textureBackground(l.item.entry, baseUrl) : undefined;
          return (
            <div
              key={l.reactKey}
              ref={l.ref}
              onAnimationEnd={l.onAnimationEnd}
              className={cx("tk-scena__el tk-scena__mata scena__mata", phaseClass(l))}
              style={
                {
                  ...rectVars(l.rect),
                  ...(padBg
                    ? { backgroundImage: padBg, "--tk-kafel": l.item.entry.tile_mm ?? 200 }
                    : {}),
                } as CSSProperties
              }
              data-pad-type={l.item.sizeMm.type}
            >
              {padBg ? null : (
                <ProductImage
                  entry={l.item.entry}
                  baseUrl={baseUrl}
                  productName={l.item.name}
                  colorName={l.item.colorName}
                  swatch={l.item.swatch}
                  matMm={{ w: l.item.sizeMm.w, d: l.item.sizeMm.d }}
                  decorative
                />
              )}
            </div>
          );
        })}
        {g.pad && !hasPadLayer ? (
          <div
            className="tk-scena__el tk-scena__mata tk-scena__mata--brak scena__mata"
            style={rectVars(g.pad)}
            data-testid="desk-pad-hint"
          >
            <span className="tk-scena__podpis">{padHint}</span>
          </div>
        ) : null}
        <div
          className={cx("tk-scena__el tk-scena__strefa scena__strefa", uwaga && "is-uwaga")}
          style={rectVars(g.zone)}
          data-testid="desk-zone"
        >
          <span className="tk-scena__podpis">{zoneCaption(zoneMm)}</span>
        </div>
        {g.zoneOutside ? (
          <div
            className="tk-scena__el tk-scena__strefa-poza scena__strefa"
            style={rectVars(g.zoneOutside)}
            data-testid="desk-zone-outside"
          />
        ) : null}
        {keyboardLayers.map((l) => (
          <div
            key={l.reactKey}
            ref={l.ref}
            onAnimationEnd={l.onAnimationEnd}
            className={cx("tk-scena__el tk-scena__obiekt scena__klawiatura", phaseClass(l))}
            style={rectVars(l.rect)}
          >
            <ProductImage
              entry={l.item.entry}
              baseUrl={baseUrl}
              productName={l.item.name}
              colorName={l.item.colorName}
              decorative
              priority={priority}
              showCaption={fits(l.rect)}
            />
          </div>
        ))}
        {mouseLayers.map((l) => (
          <div
            key={l.reactKey}
            ref={l.ref}
            onAnimationEnd={l.onAnimationEnd}
            className={cx("tk-scena__el tk-scena__obiekt scena__myszka", phaseClass(l))}
            style={rectVars(l.rect)}
          >
            <ProductImage
              entry={l.item.entry}
              baseUrl={baseUrl}
              productName={l.item.name}
              colorName={l.item.colorName}
              decorative
              priority={priority}
              showCaption={fits(l.rect)}
            />
          </div>
        ))}
      </div>
      {result ? (
        <span className={cx("tk-scena__wynik scena__wynik", uwaga && "is-uwaga")}>
          {resultBadgeText(result)}
        </span>
      ) : null}
    </div>
  );
}
