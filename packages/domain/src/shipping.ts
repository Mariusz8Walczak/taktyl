// F-065: termin wysylki i dostawy (docs/04 par. 5.4). Strefa Europe/Warsaw jawnie, zegar wstrzykiwany
// (zero Date.now()), dni robocze pon.-pt., opcjonalna lista swiat (P2).

export interface CivilDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

export interface DispatchOptions {
  /** Godzina odciecia (np. 14): zamowienie przed ta godzina w dzien roboczy wychodzi tego dnia. */
  cutoffHour: number;
  /** Strefa czasowa, np. "Europe/Warsaw" (shop.json -> timezone). */
  timeZone: string;
  /** Dni robocze dostawy po wysylce (shipping_methods[].eta_business_days). */
  etaBusinessDays: number;
  /** Dni wolne od pracy jako "RRRR-MM-DD" (swieta ustawowe, P2). */
  holidays?: readonly string[];
}

export interface DispatchInfo {
  shipsToday: boolean;
  today: CivilDate;
  dispatchDate: CivilDate;
  deliveryDate: CivilDate;
  /** Daty w postaci "RRRR-MM-DD". */
  dispatchIso: string;
  deliveryIso: string;
  /** "Wysyłka dziś" / "Wysyłka jutro" / "Wysyłka: poniedziałek, 12 października" (F-065). */
  label: string;
}

/** "RRRR-MM-DD". */
export function toIsoDate(d: CivilDate): string {
  const p = (n: number, len: number) => String(n).padStart(len, "0");
  return `${p(d.year, 4)}-${p(d.month, 2)}-${p(d.day, 2)}`;
}

/** Skladniki daty i godziny w podanej strefie (wejscie: chwila w czasie, wyjscie: czas scienny). */
export function zonedParts(now: Date, timeZone: string): { date: CivilDate; hour: number } {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("Nieprawidlowa data (zegar zwrocil Invalid Date)");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const num = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : Number.NaN;
  };
  return { date: { year: num("year"), month: num("month"), day: num("day") }, hour: num("hour") };
}

function utcMs(d: CivilDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

function fromUtcMs(ms: number): CivilDate {
  const x = new Date(ms);
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() };
}

export function addCalendarDays(d: CivilDate, days: number): CivilDate {
  return fromUtcMs(utcMs(d) + days * 86_400_000);
}

/** Dzien roboczy: pon.-pt., poza dniami z listy swiat. */
export function isBusinessDay(d: CivilDate, holidays: readonly string[] = []): boolean {
  const weekday = new Date(utcMs(d)).getUTCDay();
  return weekday >= 1 && weekday <= 5 && !holidays.includes(toIsoDate(d));
}

/** Pierwszy dzien roboczy po podanej dacie (scisle pozniejszy). */
export function nextBusinessDay(d: CivilDate, holidays: readonly string[] = []): CivilDate {
  let cur = addCalendarDays(d, 1);
  while (!isBusinessDay(cur, holidays)) cur = addCalendarDays(cur, 1);
  return cur;
}

/** Data + n dni roboczych (n = 0 zwraca date bez zmian). */
export function addBusinessDays(d: CivilDate, n: number, holidays: readonly string[] = []): CivilDate {
  let cur = d;
  for (let i = 0; i < n; i++) cur = nextBusinessDay(cur, holidays);
  return cur;
}

/** Data scienna jako tekst po polsku: "czwartek, 8 października" (Intl, strefa jawnie). */
export function formatCivilDate(d: CivilDate, timeZone: string): string {
  // Poludnie UTC: ta sama data kalendarzowa w kazdej strefie uzywanej przez sklep.
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(Date.UTC(d.year, d.month - 1, d.day, 12)));
}

/**
 * F-065: termin wysylki i dostawy.
 * - dzien roboczy przed godzina odciecia -> wysylka dzis; po odcieciu -> nastepny dzien roboczy;
 * - sobota, niedziela (i swieta) -> pierwszy dzien roboczy;
 * - dostawa = dzien wysylki + etaBusinessDays dni roboczych.
 */
export function computeDispatch(now: Date, options: DispatchOptions): DispatchInfo {
  const holidays = options.holidays ?? [];
  const { date: today, hour } = zonedParts(now, options.timeZone);
  const shipsToday = isBusinessDay(today, holidays) && hour < options.cutoffHour;
  const dispatchDate = shipsToday ? today : nextBusinessDay(today, holidays);
  const deliveryDate = addBusinessDays(dispatchDate, options.etaBusinessDays, holidays);
  const dayDiff = Math.round((utcMs(dispatchDate) - utcMs(today)) / 86_400_000);
  const label = shipsToday
    ? "Wysyłka dziś"
    : dayDiff === 1
      ? "Wysyłka jutro"
      : `Wysyłka: ${formatCivilDate(dispatchDate, options.timeZone)}`;
  return {
    shipsToday,
    today,
    dispatchDate,
    deliveryDate,
    dispatchIso: toIsoDate(dispatchDate),
    deliveryIso: toIsoDate(deliveryDate),
    label,
  };
}

/**
 * F-065: zdanie o terminie. Przed odcieciem: "Zamów do 14:00, wyślemy dziś. Dostawa kurierem: czwartek, 8 października."
 * `deliveryPhrase` to poczatek zdania o dostawie, np. "Dostawa kurierem" (odmiana nazwy metody w tresci sklepu).
 */
export function formatDispatchMessage(
  info: DispatchInfo,
  options: Pick<DispatchOptions, "cutoffHour" | "timeZone">,
  deliveryPhrase: string,
): string {
  const delivery = `${deliveryPhrase}: ${formatCivilDate(info.deliveryDate, options.timeZone)}.`;
  if (info.shipsToday) {
    const cutoff = `${String(options.cutoffHour).padStart(2, "0")}:00`;
    return `Zamów do ${cutoff}, wyślemy dziś. ${delivery}`;
  }
  return `Wyślemy: ${formatCivilDate(info.dispatchDate, options.timeZone)}. ${delivery}`;
}
