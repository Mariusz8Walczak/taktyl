// F-173: walidacja NIP po sumie kontrolnej (docs/11: bez przykladowych NIP-ow w kodzie i danych).

const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

/** Zostawia cyfry; dopuszcza spacje i myslniki jako separatory. Inne znaki -> null. */
export function normalizeNip(input: string): string | null {
  const cleaned = input.trim().replace(/[\s-]/g, "");
  return /^\d+$/.test(cleaned) ? cleaned : null;
}

/** Cyfra kontrolna dla 9 pierwszych cyfr (suma wazona mod 11); null, gdy wynik = 10 (taki numer nie istnieje). */
export function nipCheckDigit(first9: string): number | null {
  if (!/^\d{9}$/.test(first9)) return null;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(first9[i]) * (WEIGHTS[i] as number);
  const rest = sum % 11;
  return rest === 10 ? null : rest;
}

/** F-173: NIP ma dokladnie 10 cyfr i poprawna sume kontrolna. */
export function isValidNip(input: string): boolean {
  const digits = normalizeNip(input);
  if (digits === null || digits.length !== 10) return false;
  const check = nipCheckDigit(digits.slice(0, 9));
  return check !== null && check === Number(digits[9]);
}
