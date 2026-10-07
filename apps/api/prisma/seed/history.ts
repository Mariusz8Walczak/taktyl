// B-102 (docs/17 par. 5): historia cen zasilana seedem. Czysta funkcja, bez I/O.
// Wejscie pochodzi wylacznie z data/products.json (price, lowest_30d); nic nie jest wymyslane.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PriceHistoryRow {
  sku: string;
  priceGr: number;
  validFrom: Date;
  validTo: Date | null;
  reason: string;
}

export interface PriceHistoryInput {
  sku: string;
  priceGr: number;
  /** Cena sprzed obnizki (grosze) dla wariantu w promocji, inaczej null. */
  lowest30dGr: number | null;
}

/**
 * Wariant bez promocji: jeden wiersz (cena z danych, od seed - 90 dni, valid_to NULL).
 * Promocja: wiersz 1 = lowest_30d od seed - 90 dni do seed - 2 dni, wiersz 2 = price od seed - 2 dni.
 * Algorytm z docs/17 par. 5 daje wtedy lowest_30d dokladnie z danych.
 */
export function buildPriceHistory(input: PriceHistoryInput, now: Date): PriceHistoryRow[] {
  const from = new Date(now.getTime() - 90 * DAY_MS);
  if (input.lowest30dGr === null) {
    return [
      { sku: input.sku, priceGr: input.priceGr, validFrom: from, validTo: null, reason: "seed" },
    ];
  }
  if (input.lowest30dGr <= input.priceGr) {
    throw new RangeError(`${input.sku}: lowest_30d musi byc wyzsze od ceny biezacej`);
  }
  const cut = new Date(now.getTime() - 2 * DAY_MS);
  return [
    { sku: input.sku, priceGr: input.lowest30dGr, validFrom: from, validTo: cut, reason: "seed" },
    {
      sku: input.sku,
      priceGr: input.priceGr,
      validFrom: cut,
      validTo: null,
      reason: "seed: promocja",
    },
  ];
}
