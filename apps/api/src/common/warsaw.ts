// B-201 (docs/16 par. 1): daty kalendarzowe z filtrow interpretujemy w strefie Europe/Warsaw (Intl, bez recznych stref).

/** Przesuniecie Europe/Warsaw wzgledem UTC w minutach w danej chwili (np. 120 latem, 60 zima). */
function warsawOffsetMinutes(at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Warsaw", timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** Poczatek doby (00:00) danego dnia RRRR-MM-DD w Warszawie jako chwila UTC. */
export function warsawDayStart(date: string): Date {
  const utcMidnight = new Date(`${date}T00:00:00Z`).getTime();
  let local = utcMidnight - warsawOffsetMinutes(new Date(utcMidnight)) * 60_000;
  // Druga poprawka na wypadek, gdy przesuniecie w chwili `local` rozni sie od tego w `utcMidnight`.
  local = utcMidnight - warsawOffsetMinutes(new Date(local)) * 60_000;
  return new Date(local);
}

/** Poczatek nastepnej doby (wylaczna gorna granica zakresu "do dnia wlacznie"). */
export function warsawNextDayStart(date: string): Date {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return warsawDayStart(next.toISOString().slice(0, 10));
}
