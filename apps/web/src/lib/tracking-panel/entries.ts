// F-243 (TAKTYL-60, docs/10 §6): logika panelu podgladu zdarzen bez React - odczyt historii z `dataLayer`, zapis
// pozycji z `taktyl:track`, rozpoznanie wpisow zgody (consent default/update), godzina Europe/Warsaw, JSON do kopii.
export interface TrackEntry {
  id: number;
  /** Nazwa zdarzenia (`add_to_cart`) albo "consent default" / "consent update". */
  name: string;
  /** Moment odebrania (ms); null dla wpisow sprzed otwarcia panelu (dataLayer nie niesie czasu). */
  at: number | null;
  payload: unknown;
}

/** Strefa sklepu (regula 7): godzina w panelu zawsze po warszawsku, niezaleznie od strefy przegladarki. */
const TIME = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function formatTime(at: number | null): string {
  return at === null ? "wcześniej" : TIME.format(at);
}

let seq = 0;
export const nextId = (): number => ++seq;

/** gtag('consent', 'default'|'update', {...}) wpada do dataLayer jako obiekt `arguments`. */
export function consentEntry(raw: unknown, at: number | null): TrackEntry | null {
  const arr = Array.isArray(raw)
    ? raw
    : isArguments(raw)
      ? Array.from(raw as ArrayLike<unknown>)
      : null;
  if (!arr || arr[0] !== "consent" || (arr[1] !== "default" && arr[1] !== "update")) return null;
  return { id: nextId(), name: `consent ${arr[1]}`, at, payload: arr[2] ?? {} };
}

function isArguments(v: unknown): boolean {
  return Object.prototype.toString.call(v) === "[object Arguments]";
}

/** Zdarzenie z dataLayer (obiekt z `event`) jako pozycja; `ecommerce: null` (czyszczenie) i obce wpisy pomijane. */
export function dataLayerEntry(raw: unknown, at: number | null): TrackEntry | null {
  const consent = consentEntry(raw, at);
  if (consent) return consent;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const event = (raw as { event?: unknown }).event;
  if (typeof event !== "string" || event.startsWith("gtm.")) return null;
  return { id: nextId(), name: event, at, payload: raw };
}

/** Pozycja ze zdarzenia DOM `taktyl:track` (detail = payload wyslany do dataLayer). */
export function domEventEntry(detail: unknown, at: number): TrackEntry | null {
  if (!detail || typeof detail !== "object") return null;
  const event = (detail as { event?: unknown }).event;
  return typeof event === "string" ? { id: nextId(), name: event, at, payload: detail } : null;
}

/** Historia dataLayer sprzed otwarcia panelu (np. view_item i consent default). */
export function seedFromDataLayer(layer: readonly unknown[] | undefined): TrackEntry[] {
  const out: TrackEntry[] = [];
  for (const raw of layer ?? []) {
    const e = dataLayerEntry(raw, null);
    if (e) out.push(e);
  }
  return out;
}

/** "Kopiuj jako JSON": tablica { event, time (ISO) | null, ...payload }. */
export function entriesToJson(entries: readonly TrackEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({
      name: e.name,
      time: e.at === null ? null : new Date(e.at).toISOString(),
      payload: e.payload,
    })),
    null,
    2,
  );
}

export const prettyPayload = (payload: unknown): string => JSON.stringify(payload, null, 2);

/** Kopiowanie: Clipboard API, a gdy go brak lub odmowa - zapasowo textarea + execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* zapas ponizej */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.setAttribute("aria-hidden", "true");
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
