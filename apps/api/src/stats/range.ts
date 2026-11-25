// B-610, B-620 (docs/25 par. 2): zakres dat pulpitu w Europe/Warsaw i okres poprzedni tej samej dlugosci.
// Czysta logika (bez I/O): dni kalendarzowe jako tekst RRRR-MM-DD, granice doby przez warsawDayStart (Intl).
import { STATS_MAX_DAYS, type StatsRange } from "@taktyl/contracts";
import { validationFailed } from "../common/app-exception.js";
import { warsawDayStart, warsawNextDayStart } from "../common/warsaw.js";

export const DEFAULT_RANGE_DAYS = 30;

const warsawDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const warsawDowHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Warsaw",
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});
const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Data kalendarzowa chwili w Europe/Warsaw (RRRR-MM-DD). */
export const warsawDateOf = (at: Date): string => warsawDate.format(at);

/** Dzien tygodnia (1 = poniedzialek) i godzina chwili w Europe/Warsaw. */
export function warsawDowHourOf(at: Date): { dow: number; hour: number } {
  const parts = warsawDowHour.formatToParts(at);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { dow: DOW[wd] ?? 1, hour: hour === 24 ? 0 : hour };
}

/** Dodaje dni do daty kalendarzowej (arytmetyka w UTC na samych datach, bez stref). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Liczba dni od `from` do `to` wlacznie. */
export function daysBetween(from: string, to: string): number {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  );
}

export interface StatsWindow {
  from: string;
  to: string;
  /** poczatek `from` w Warszawie */
  start: Date;
  /** poczatek dnia po `to` (granica wylaczna) */
  end: Date;
  /** kolejne dni zakresu */
  days: string[];
}

export function windowOf(from: string, to: string): StatsWindow {
  const n = daysBetween(from, to);
  return {
    from,
    to,
    start: warsawDayStart(from),
    end: warsawNextDayStart(to),
    days: Array.from({ length: n }, (_, i) => addDays(from, i)),
  };
}

export interface ResolvedRange {
  current: StatsWindow;
  previous: StatsWindow | null;
  range: StatsRange;
}

/** Zakres z zapytania; brak `from`/`to` = ostatnie 30 dni do dzis. 400 dla odwroconego lub zbyt dlugiego zakresu. */
export function resolveRange(
  query: { from?: string | undefined; to?: string | undefined; compare: "previous" | "none" },
  now: Date,
): ResolvedRange {
  const today = warsawDateOf(now);
  const to = query.to ?? (query.from && query.from > today ? query.from : today);
  const from = query.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  const days = daysBetween(from, to);
  if (days < 1 || days > STATS_MAX_DAYS) {
    throw validationFailed(
      [
        {
          path: days < 1 ? "from" : "to",
          code: days < 1 ? "range_inverted" : "range_too_long",
          message:
            days < 1 ? "Poczatek zakresu jest po koncu." : `Zakres do ${STATS_MAX_DAYS} dni.`,
        },
      ],
      400,
    );
  }
  const current = windowOf(from, to);
  const previous =
    query.compare === "previous" ? windowOf(addDays(from, -days), addDays(from, -1)) : null;
  return {
    current,
    previous,
    range: {
      from,
      to,
      days,
      previous: previous ? { from: previous.from, to: previous.to } : null,
    },
  };
}

/** Mediana (zaokraglona w dol) listy liczb; 0 dla pustej. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.floor(
    s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2,
  );
}

/** Udzial w punktach bazowych (0..10000), bez dzielenia przez zero. */
export const shareBp = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.min(10_000, Math.round((part * 10_000) / whole));
