// F-064, F-107, F-155: pieniadze w groszach (liczby calkowite) i formatowanie przez Intl (regula 7, pulapki 5-6).

/** Kwota w groszach (liczba calkowita). */
export type Grosze = number;

const plnFormat = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
const plnSignedFormat = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  signDisplay: "exceptZero",
});

function assertGrosze(gr: number): void {
  if (!Number.isSafeInteger(gr)) {
    throw new RangeError(`Kwota musi byc liczba calkowita groszy, otrzymano: ${gr}`);
  }
}

/**
 * Zamiana zlotych z JSON-a na grosze. Jedyne miejsce, w ktorym stosujemy Math.round
 * na kwocie wejsciowej (docs/04 par. 3).
 */
export function toGrosze(zl: number): Grosze {
  if (!Number.isFinite(zl)) {
    throw new RangeError(`Nieprawidlowa kwota: ${zl}`);
  }
  return Math.round(zl * 100);
}

/** Kwota w groszach jako tekst "1203,30 zł" (wynik Intl, bez recznych poprawek). */
export function formatPLN(gr: Grosze): string {
  assertGrosze(gr);
  return plnFormat.format(gr / 100);
}

/** Kwota ze znakiem ("+50,00 zł", "-133,70 zł"; zero bez znaku) - propozycje zmian, rabaty. */
export function formatPLNSigned(gr: Grosze): string {
  assertGrosze(gr);
  return plnSignedFormat.format(gr / 100);
}

/** Liczba w formacie polskim, np. 26000 -> "26 000". */
export function formatNumber(n: number, maximumFractionDigits?: number): string {
  return n.toLocaleString(
    "pl-PL",
    maximumFractionDigits === undefined ? undefined : { maximumFractionDigits },
  );
}

/** Liczba z jednostka i twarda spacja (U+00A0): "26 000 DPI", "49 g". */
export function formatWithUnit(n: number, unit: string, maximumFractionDigits?: number): string {
  return `${formatNumber(n, maximumFractionDigits)}\u00A0${unit}`;
}

/** Milimetry jako centymetry z jednym miejscem po przecinku: 327 -> "32,7" (docs/03 par. 4.2). */
export function formatCmFromMm(mm: number): string {
  return formatNumber(mm / 10, 1);
}

/** Milimetry jako "32,7 cm" z twarda spacja. */
export function formatMmAsCm(mm: number): string {
  return `${formatCmFromMm(mm)}\u00A0cm`;
}

/** Zakres w jednostce, np. (18, 20.5, "cm") -> "18–20,5 cm" (docs/04 par. 4). */
export function formatRangeWithUnit(min: number, max: number, unit: string): string {
  return `${formatNumber(min, 1)}–${formatNumber(max, 1)}\u00A0${unit}`;
}

/** Waga: < 1000 g -> "590 g"; od 1000 g -> "1,85 kg" (docs/04 par. 4). */
export function formatWeight(g: number): string {
  return g < 1000 ? formatWithUnit(g, "g") : formatWithUnit(g / 1000, "kg", 2);
}

/** Wymiary w mm jako "32,7 × 14 × 3,6 cm" (docs/04 par. 4). */
export function formatDimensionsCm(dimsMm: readonly number[]): string {
  return `${dimsMm.map((mm) => formatCmFromMm(mm)).join(" × ")}\u00A0cm`;
}
