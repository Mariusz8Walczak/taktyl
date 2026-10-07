// F-106 (DeskStage), docs/03 §5.1: czysta geometria podgladu biurka. Wejscie i wyjscie w mm
// (plotno 1 px = 1 mm), bez DOM. Trzy uklady: brak podkladki, mata na biurko, podkladka pod myszke.

export interface SizeMm {
  w: number;
  d: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

export type DeskLayout = "brak" | "mata" | "podkladka";
export type PadType = "biurko" | "mysz";

export interface DeskGeometryInput {
  /** Klawiatura (dims_mm); brak = element pominiety, a szerokosc 0. */
  keyboard: SizeMm | null;
  mouse: SizeMm | null;
  /** sizes[variant.size] z products.json. */
  pad: (SizeMm & { type: PadType }) | null;
  /** Strefa ruchu myszki (mm), z profilu albo no_profile (rules.json). */
  zoneMm: number;
  gapMm: number;
  marginMm: number;
}

export interface DeskGeometry {
  layout: DeskLayout;
  canvas: SizeMm;
  /** Podkladka albo, w ukladzie "brak", prostokat zastepczy na cale plotno. */
  pad: Rect | null;
  keyboard: Rect | null;
  zone: Rect;
  mouse: Rect | null;
  /** Czesc strefy poza podkladka (do oznaczenia kolorem --uwaga) albo null. */
  zoneOutside: Rect | null;
  /** Wymagana szerokosc: 2*margin + kb.w + gap + zone (mata) albo strefa (podkladka pod myszke). */
  requiredMm: number | null;
  /** pad.w - requiredMm (ujemny = brak), tylko gdy jest podkladka i myszka/regula ma zastosowanie. */
  spareMm: number | null;
}

/** Plotno uzywane, gdy nie ma podkladki (docs/03 §5.1: 900 x 400). */
export const NO_PAD_CANVAS: SizeMm = { w: 900, d: 400 };

export function computeDeskGeometry(input: DeskGeometryInput): DeskGeometry {
  const { keyboard, mouse, pad, zoneMm, gapMm: gap, marginMm: margin } = input;
  const kbW = keyboard?.w ?? 0;
  const kbD = keyboard?.d ?? 0;
  const zoneX = margin + kbW + gap;
  const minD = keyboard ? kbD + 2 * margin : 0;
  const requiredDesk = 2 * margin + kbW + gap + zoneMm;

  if (!pad) {
    // Ten sam uklad, ale plotno nie mniejsze niz 900 x 400 i niz wymaga zawartosc (zawartosc nie jest ucinana).
    const canvas = {
      w: Math.max(NO_PAD_CANVAS.w, requiredDesk),
      d: Math.max(NO_PAD_CANVAS.d, minD),
    };
    return finish("brak", canvas, { x: 0, y: 0, ...canvas }, zoneX, canvas.d - 2 * margin, null);
  }

  if (pad.type === "biurko") {
    const canvas = { w: Math.max(pad.w, requiredDesk), d: Math.max(pad.d, minD) };
    const padRect = { x: 0, y: 0, w: pad.w, d: pad.d };
    return finish("mata", canvas, padRect, zoneX, pad.d - 2 * margin, requiredDesk, padRect);
  }

  // Podkladka pod myszke: klawiatura na "blacie", podkladka za nia.
  const canvas = {
    w: margin + kbW + gap + Math.max(pad.w, zoneMm) + margin,
    d: Math.max(pad.d, minD),
  };
  const padRect = { x: zoneX, y: (canvas.d - pad.d) / 2, w: pad.w, d: pad.d };
  return finish("podkladka", canvas, padRect, zoneX, pad.d - 2 * margin, zoneMm, padRect);

  function finish(
    layout: DeskLayout,
    cv: SizeMm,
    padR: Rect,
    zx: number,
    zoneD: number,
    required: number | null,
    realPad?: Rect,
  ): DeskGeometry {
    const zone: Rect = { x: zx, y: (cv.d - zoneD) / 2, w: zoneMm, d: zoneD };
    const kb: Rect | null = keyboard ? { x: margin, y: (cv.d - kbD) / 2, w: kbW, d: kbD } : null;
    // Mysz: srodek strefy (brak, mata) albo srodek podkladki (podkladka); przy podkladce szerszej niz strefa
    // srodek podkladki jest tez w strefie, bo strefa zaczyna sie od jej lewej krawedzi.
    const centerX = layout === "podkladka" ? padR.x + padR.w / 2 : zone.x + zone.w / 2;
    const centerY = layout === "podkladka" ? padR.y + padR.d / 2 : zone.y + zone.d / 2;
    const m: Rect | null = mouse
      ? { x: centerX - mouse.w / 2, y: centerY - mouse.d / 2, w: mouse.w, d: mouse.d }
      : null;
    const outsideW = realPad ? zone.x + zone.w - (realPad.x + realPad.w) : 0;
    const zoneOutside: Rect | null =
      realPad && outsideW > 0
        ? { x: realPad.x + realPad.w, y: zone.y, w: outsideW, d: zone.d }
        : null;
    return {
      layout,
      canvas: cv,
      pad: padR,
      keyboard: kb,
      zone,
      mouse: m,
      zoneOutside,
      requiredMm: required,
      spareMm: realPad && required !== null ? realPad.w - required : null,
    };
  }
}
