// B-008, B-208 (docs/15 par. 6, docs/16 par. 4 pkt 2): maskowanie danych osobowych po stronie API (nie tylko w UI).
// Formaty z docs/15 B-008: "a***@taktyl.example", "+48 *** *** 000". Funkcje czyste, bez I/O.

/** a***@taktyl.example (pierwszy znak lokalnej czesci + domena). Wartosc bez "@" jest maskowana w calosci. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** +48 *** *** 000 (ostatnie 3 cyfry). Krotszy ciag cyfr jest maskowany w calosci. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return "+48 *** *** ***";
  return `+48 *** *** ${digits.slice(-3)}`;
}

/** Imie i nazwisko: pierwsza litera kazdego wyrazu i gwiazdki ("J*** P***"). */
export function maskName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "***";
  return words.map((w) => `${[...w][0] ?? ""}***`).join(" ");
}

/** NIP: ostatnie 3 cyfry, reszta gwiazdki. */
export function maskNip(nip: string): string {
  const digits = nip.replace(/\D/g, "");
  return digits.length >= 3 ? `*******${digits.slice(-3)}` : "*******";
}

const MASKERS: Record<string, (v: string) => string> = {
  email: maskEmail,
  contact_email: maskEmail,
  phone: maskPhone,
  contact_phone: maskPhone,
  name: maskName,
  nip: maskNip,
  street: () => "***",
  address: () => "***",
  postcode: () => "**-***",
  city: () => "***",
};

/** Maskuje znane pola osobowe w plaskim obiekcie tekstowym (adres dostawy, faktura). Pole bez maskera zostaje bez zmian. */
export function maskRecord(record: Record<string, string> | null): Record<string, string> | null {
  if (record === null) return null;
  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [
      k,
      MASKERS[k] && typeof v === "string" ? MASKERS[k](v) : v,
    ]),
  );
}

/** Klucze, ktorych wartosci sa danymi osobowymi (klienta i personelu); uzywane do maskowania wartosci w dzienniku dla viewer. */
export const PERSONAL_KEYS: ReadonlySet<string> = new Set(Object.keys(MASKERS));

/** Rekurencyjnie maskuje pola osobowe w dowolnym JSON-ie (np. before/after z audit_log dla viewer, docs/15 par. 3). */
export function maskPersonalDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskPersonalDeep);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === "string" && MASKERS[k] ? MASKERS[k](v) : maskPersonalDeep(v),
      ]),
    );
  }
  return value;
}
