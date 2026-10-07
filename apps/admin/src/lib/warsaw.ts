// Granice dnia w Europe/Warsaw (regula 7): data z pola "date" -> chwila ISO z przesunieciem, takze w dniach zmiany czasu.
const parts = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Warsaw",
  timeZoneName: "longOffset",
});

function offsetMinutes(instant: Date): number {
  const name = parts.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** "2026-10-07" + "00:00:00" -> "2026-10-07T00:00:00+02:00". */
export function warsawIso(date: string, time: string): string {
  const utcGuess = new Date(`${date}T${time}Z`);
  let off = offsetMinutes(utcGuess);
  off = offsetMinutes(new Date(utcGuess.getTime() - off * 60_000));
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${date}T${time}${sign}${hh}:${mm}`;
}
