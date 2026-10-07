// B-200 (docs/17 par. 3.4, decyzja C-002): numer zamowienia TK-RRMMDD-XXXX; data w strefie Europe/Warsaw,
// XXXX z alfabetu bez znakow mylnych (bez 0, O, 1, I).
export const ORDER_NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ORDER_NUMBER_PATTERN = /^TK-\d{6}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

/** RRMMDD w strefie Europe/Warsaw (Intl, bez recznej arytmetyki stref). */
export function warsawDateStamp(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

/** `random` zwraca liczbe z zakresu [0, 1); domyslnie crypto.getRandomValues. */
export function generateOrderNumber(now: Date, random: () => number = cryptoRandom): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += ORDER_NUMBER_ALPHABET[Math.floor(random() * ORDER_NUMBER_ALPHABET.length)];
  }
  return `TK-${warsawDateStamp(now)}-${suffix}`;
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 2 ** 32;
}
