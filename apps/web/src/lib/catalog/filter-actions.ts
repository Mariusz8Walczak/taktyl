// F-021, F-023 (docs/04 §6): zmiany stanu filtrow jako czyste funkcje (nowy stan, wejscie bez zmian).
// Wyspa kliencka listingu tylko woła te funkcje i serializuje wynik do adresu (domain: serializeListingQuery).
import type { FilterState } from "@taktyl/domain";

/** multi/buckets: dodaje albo zdejmuje wartosc; pusta lista usuwa filtr. */
export function toggleValue(state: FilterState, facetId: string, value: string): FilterState {
  const next: FilterState = { ...state };
  const current = Array.isArray(next[facetId]) ? (next[facetId] as string[]) : [];
  const list = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  if (list.length > 0) next[facetId] = list;
  else delete next[facetId];
  return next;
}

/** bool: wlaczony = true, wylaczony = brak wpisu. */
export function setBool(state: FilterState, facetId: string, on: boolean): FilterState {
  const next: FilterState = { ...state };
  if (on) next[facetId] = true;
  else delete next[facetId];
  return next;
}

/** range (grosze): oba konce puste albo rowne granicom katalogu zdejmuja filtr. */
export function setRange(
  state: FilterState,
  facetId: string,
  minGr: number | null,
  maxGr: number | null,
  bounds?: { min: number; max: number },
): FilterState {
  const next: FilterState = { ...state };
  const lo = bounds && minGr !== null && minGr <= bounds.min ? null : minGr;
  const hi = bounds && maxGr !== null && maxGr >= bounds.max ? null : maxGr;
  if (lo === null && hi === null) delete next[facetId];
  else next[facetId] = { min: lo, max: hi };
  return next;
}

/** number-match: liczba (cm) albo brak. */
export function setNumber(state: FilterState, facetId: string, n: number | null): FilterState {
  const next: FilterState = { ...state };
  if (n === null || !Number.isFinite(n)) delete next[facetId];
  else next[facetId] = n;
  return next;
}

/** Tekst pola liczbowego ("19,5", "19.5") -> liczba albo null. */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
