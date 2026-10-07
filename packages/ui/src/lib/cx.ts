/** Skleja nazwy klas, pomijajac wartosci puste. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
