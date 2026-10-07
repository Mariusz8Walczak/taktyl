// F-106, docs/03 §5.4: tekst dla czytnika ekranu i podpisy podgladu biurka, skladane z danych.
// Liczby w cm przez formatery domeny (przecinek dziesietny, twarda spacja).
import { formatMmAsCm } from "@taktyl/domain";
import type { PadType } from "./geometry.js";

/** Wynik reguly szerokosci (pad-width-desk albo pad-width-mouse) z @taktyl/domain evaluateFit. */
export interface DeskResult {
  status: "ok" | "uwaga";
  /** Zapas w mm (status ok), gdy znany. */
  spareMm?: number | null;
  /** Brak w mm (status uwaga), gdy znany. */
  shortfallMm?: number | null;
}

export interface DeskLabelInput {
  keyboardName: string | null;
  mouseName: string | null;
  pad: { name: string; sizeLabel: string; type: PadType } | null;
  result: DeskResult | null;
}

/** "Podglad: Bazalt 75 i Pustulka na macie Szron XL. Zapas 28,3 cm." */
export function composeDeskLabel({ keyboardName, mouseName, pad, result }: DeskLabelInput): string {
  const names = [keyboardName, mouseName].filter((n): n is string => Boolean(n));
  const subject = names.length ? names.join(" i ") : "puste biurko";
  const place = pad
    ? ` ${pad.type === "biurko" ? "na macie" : "na podkładce"} ${pad.name} ${pad.sizeLabel}`
    : names.length
      ? " bez podkładki"
      : "";
  return `Podgląd: ${subject}${place}.${resultSentence(result)}`;
}

function resultSentence(result: DeskResult | null): string {
  if (!result) return "";
  if (result.status === "ok") {
    return result.spareMm != null ? ` Zapas ${formatMmAsCm(Math.max(0, result.spareMm))}.` : "";
  }
  return result.shortfallMm != null && result.shortfallMm > 0
    ? ` Uwaga: brakuje ${formatMmAsCm(result.shortfallMm)}.`
    : " Uwaga.";
}

/** Plakietka wyniku na scenie (A-02 "scena__wynik"): "Pasuje · zapas 28,3 cm". */
export function resultBadgeText(result: DeskResult): string {
  if (result.status === "ok") {
    return result.spareMm != null
      ? `Pasuje · zapas ${formatMmAsCm(Math.max(0, result.spareMm))}`
      : "Pasuje";
  }
  return result.shortfallMm != null && result.shortfallMm > 0
    ? `Uwaga · brakuje ${formatMmAsCm(result.shortfallMm)}`
    : "Uwaga";
}

/** Podpis strefy myszki: "Ruch myszki: 40 cm". */
export function zoneCaption(zoneMm: number): string {
  return `Ruch myszki: ${formatMmAsCm(zoneMm)}`;
}
