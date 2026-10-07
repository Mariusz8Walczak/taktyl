// B-214 (docs/17 par. 5, ADR-0005, F-064): "najnizsza cena z 30 dni przed obnizka" liczona z price_history.
// Czysta funkcja bez I/O; brak pola recznego. Wiersze: price_history jednego SKU.
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PriceRow {
  priceGr: number;
  validFrom: Date;
  validTo: Date | null;
}

export interface PromotionInfo {
  /** Najnizsza cena obowiazujaca w oknie przed pierwsza obnizka lancucha; null poza promocja. */
  lowest30dGr: number | null;
  /** Chwila pierwszej obnizki lancucha (T_cut); null poza promocja. */
  cutAt: Date | null;
}

const NONE: PromotionInfo = { lowest30dGr: null, cutAt: null };

/**
 * Algorytm z docs/17 par. 5:
 * 1. obnizka = wiersz o cenie nizszej niz poprzedni; promocja wymaga, by BIEZACY wiersz byl obnizka;
 * 2. lancuch: kolejna obnizka przed uplywem okna nie resetuje punktu odniesienia (cofamy sie po obnizkach
 *    oddzielonych o mniej niz okno); T_cut = poczatek lancucha;
 * 3. promocja trwa `windowDays` od T_cut (pozniej cena jest nowa cena zwykla);
 * 4. lowest = MIN ceny wierszy obowiazujacych w [T_cut - okno, T_cut); promocja tylko gdy lowest > cena biezaca.
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
