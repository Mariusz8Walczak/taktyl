// F-220: czas czytania artykulu = ceil(slowa / 200), jak w walidatorze tresci (D-011). Czysta funkcja.
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/[|#>*_`[\]()-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** "4 min czytania" - skrot jednostki, bez odmiany. */
export function readingLabel(minutes: number): string {
  return `${minutes} min czytania`;
}

/** F-220: wejscie do kreatora z profilem poradnika (docs/03 §1, entry `guide`). */
export function builderHref(profile: string | null): string {
  return profile
    ? `/zbuduj-set?profil=${encodeURIComponent(profile)}&wejscie=guide`
    : "/zbuduj-set?wejscie=guide";
}
