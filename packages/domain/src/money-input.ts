// B-104, B-400 (TAKTYL-51): pole kwoty w zlotych w backpanelu -> grosze. Bez liczb zmiennoprzecinkowych:
// tekst jest rozbijany na zlote i grosze i skladany na calkowite grosze (docs/11 pulapka 5).
import type { Grosze } from "./money.js";

/**
 * "749", "749,00", "749.5", "1 299,99" -> grosze (74900, 74900, 74950, 129999). Zwraca null, gdy tekst nie jest kwota
 * z co najwyzej dwoma miejscami po przecinku (ujemne, puste i tekstowe wartosci tez daja null).
 */
export function parseZlotyInput(text: string): Grosze | null {
  const cleaned = text.replace(/\s/g, "");
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const zl = Number(m[1]);
  const gr = m[2] === undefined ? 0 : Number(m[2].padEnd(2, "0"));
  return zl * 100 + gr;
}

const plain = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});

/** Grosze -> tekst do pola kwoty (74900 -> "749,00"), bez symbolu waluty i bez separatora tysiecy. */
export function formatZlotyInput(gr: Grosze): string {
  if (!Number.isSafeInteger(gr))
    throw new RangeError(`Kwota musi byc liczba calkowita groszy, otrzymano: ${gr}`);
  return plain.format(gr / 100);
}
