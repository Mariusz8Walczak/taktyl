// F-065 (docs/04 §5.4): termin wysylki i dostawy z odpowiedzi API (`/v1/shipping-estimate`, liczy domain w strefie
// Europe/Warsaw). Tu tylko skladanie tekstu przez funkcje domeny (formatDispatchMessage, formatCivilDate) i Intl.
import {
  addCalendarDays,
  formatDispatchMessage,
  formatCivilDate,
  zonedParts,
  type CivilDate,
  type DispatchInfo,
} from "@taktyl/domain";

export interface EstimateInput {
  dispatch_date: string;
  delivery_date: string;
  dispatches_today: boolean;
  computed_at: string;
}

export interface DispatchTexts {
  /** "Wysyłka dziś" / "Wysyłka jutro" / "Wysyłka: poniedziałek, 12 października". */
  headline: string;
  /** "Zamów do 14:00, wyślemy dziś. Dostawa kurierem: czwartek, 8 października." */
  message: string;
}

/** "2026-10-08" -> data kalendarzowa. */
export function parseIsoDate(iso: string): CivilDate {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { year: y ?? 0, month: m ?? 0, day: d ?? 0 };
}

const same = (a: CivilDate, b: CivilDate) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

export function dispatchTexts(
  est: EstimateInput,
  opts: { cutoffHour: number; timeZone: string },
  deliveryPhrase = "Dostawa kurierem",
): DispatchTexts {
  const today = zonedParts(new Date(est.computed_at), opts.timeZone).date;
  const dispatchDate = parseIsoDate(est.dispatch_date);
  const deliveryDate = parseIsoDate(est.delivery_date);
  const headline = est.dispatches_today
    ? "Wysyłka dziś"
    : same(addCalendarDays(today, 1), dispatchDate)
      ? "Wysyłka jutro"
      : `Wysyłka: ${formatCivilDate(dispatchDate, opts.timeZone)}`;
  const info: DispatchInfo = {
    shipsToday: est.dispatches_today,
    today,
    dispatchDate,
    deliveryDate,
    dispatchIso: est.dispatch_date,
    deliveryIso: est.delivery_date,
    label: headline,
  };
  return { headline, message: formatDispatchMessage(info, opts, deliveryPhrase) };
}
