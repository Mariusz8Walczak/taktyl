// Pomocnik klas CSS kreatora (bez zaleznosci): laczy tylko prawdziwe wartosci.
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
