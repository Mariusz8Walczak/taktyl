// B-105, B-106, F-064 (docs/17 par. 5, ADR-0005): "najnizsza cena z 30 dni przed obnizka" liczona z historii cen.
// Czysta funkcja bez I/O; nie istnieje reczne pole. Backpanel uzywa jej do podgladu skutku zmiany ceny przed zapisem;
// wartosc autorytatywna po zapisie zwraca API (price-history). Zgodna z apps/api/src/pricing/lowest30d.ts (ADM-004).
import type { Grosze } from "./money.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PriceRow {
  priceGr: Grosze;
  validFrom: Date;
  validTo: Date | null;
}

export interface PromotionInfo {
  /** Najnizsza cena obowiazujaca w oknie przed pierwsza obnizka lancucha; null poza promocja. */
  lowest30dGr: Grosze | null;
  /** Chwila pierwszej obnizki lancucha; null poza promocja. */
  cutAt: Date | null;
}

const NONE: PromotionInfo = { lowest30dGr: null, cutAt: null };

/**
 * Algorytm z docs/17 par. 5: promocja wymaga, by BIEZACY wiersz byl obnizka; kolejna obnizka przed uplywem okna nie
 * resetuje punktu odniesienia; promocja trwa `windowDays` od poczatku lancucha; lowest = MIN cen obowiazujacych
 * w [T_cut - okno, T_cut); promocja tylko gdy lowest > cena biezaca.
 */
export function computePromotion(
  rows: readonly PriceRow[],
  now: Date,
  windowDays = 30,
): PromotionInfo {
  if (rows.length < 2) return NONE;
  const sorted = [...rows].sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
  const windowMs = windowDays * DAY_MS;
  const price = (i: number): number => (sorted[i] as PriceRow).priceGr;
  const from = (i: number): number => (sorted[i] as PriceRow).validFrom.getTime();
  const isCut = (i: number): boolean => i > 0 && price(i - 1) > price(i);

  const last = sorted.length - 1;
  if (!isCut(last)) return NONE;
  let k = last;
  while (k > 1 && isCut(k - 1) && from(k) - from(k - 1) < windowMs) k -= 1;
  const cut = from(k);
  if (now.getTime() - cut > windowMs) return NONE;

  const reference = sorted.filter(
    (r) =>
      r.validFrom.getTime() < cut && (r.validTo === null || r.validTo.getTime() > cut - windowMs),
  );
  if (reference.length === 0) return NONE;
  const lowest = Math.min(...reference.map((r) => r.priceGr));
  return lowest > price(last) ? { lowest30dGr: lowest, cutAt: new Date(cut) } : NONE;
}

/** Plakietka -N% = floor((lowest - cena) * 100 / lowest) w arytmetyce calkowitej (docs/04 par. 5.2); null poza promocja. */
export function promotionPercent(lowestGr: Grosze | null, priceGr: Grosze): number | null {
  if (lowestGr === null || lowestGr <= 0 || lowestGr <= priceGr) return null;
  return Math.floor(((lowestGr - priceGr) * 100) / lowestGr);
}

export interface PricePreview {
  /** Najnizsza cena z 30 dni, ktora sklep pokaze przy nowej cenie; null = nowa cena nie jest ogloszona obnizka. */
  lowest30dGr: Grosze | null;
  percent: number | null;
}

/**
 * B-106: podglad skutku zapisu nowej ceny. Dopisuje do historii hipotetyczny wiersz (zamyka biezacy) i liczy
 * `computePromotion` tak, jak policzy API po zapisie. Ta sama cena nie dopisuje wiersza (jak w API).
 */
export function previewPriceChange(
  rows: readonly PriceRow[],
  newPriceGr: Grosze,
  now: Date,
): PricePreview {
  const current = [...rows]
    .filter((r) => r.validTo === null)
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];
  if (current && current.priceGr === newPriceGr) {
    const info = computePromotion(rows, now);
    return {
      lowest30dGr: info.lowest30dGr,
      percent: promotionPercent(info.lowest30dGr, newPriceGr),
    };
  }
  const closed = rows.map((r) => (r.validTo === null ? { ...r, validTo: now } : r));
  const info = computePromotion(
    [...closed, { priceGr: newPriceGr, validFrom: now, validTo: null }],
    now,
  );
  return { lowest30dGr: info.lowest30dGr, percent: promotionPercent(info.lowest30dGr, newPriceGr) };
}
