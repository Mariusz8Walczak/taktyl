// I-010 (TAKTYL-44): poprawne NIP-y sa generowane w tescie (regula 5, docs/12 par. 2) - nigdy wpisane na stale.
import { randomInt } from "node:crypto";

const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

/** Losowy NIP o poprawnej sumie kontrolnej (10 cyfr). */
export function generateNip(): string {
  for (;;) {
    const digits = [randomInt(1, 10), ...Array.from({ length: 8 }, () => randomInt(0, 10))];
    const sum = digits.reduce((acc, d, i) => acc + d * (WEIGHTS[i] as number), 0);
    const check = sum % 11;
    if (check !== 10) return [...digits, check].join("");
  }
}

/** Ten sam numer ze zmieniona ostatnia cyfra: suma kontrolna przestaje sie zgadzac. */
export function breakNip(nip: string): string {
  const last = Number(nip[9]);
  return nip.slice(0, 9) + String((last + 1) % 10);
}
