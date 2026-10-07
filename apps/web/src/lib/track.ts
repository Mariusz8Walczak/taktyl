// F-242 (docs/10 §1 i §6): JEDYNE zrodlo zdarzen pomiaru (TAKTYL-43 rozbudowuje stub z listingu bez zmiany sygnatury
// `track(event, params)`). Zadnych bezposrednich wywolan gtag() ani pikseli w komponentach (regula 9).
// Zdarzenia trafiaja do window.dataLayer w obu trybach zgody; narzedzia zewnetrzne (GTM) laduje dopiero
// lib/consent/consent.ts po zgodzie analitycznej, wiec bez zgody nic nie wychodzi poza przegladarke.
import { readItem, writeItem } from "./storage/safe-storage";
import { buildItem } from "./track-items";
import type { TrackLineSource } from "./track-items";
import type { TrackEventMap, TrackEventName } from "./track-events";

export type TrackParams = Record<string, unknown>;

/** Zdarzenie DOM dla panelu podgladu (F-243, TAKTYL-60) przy ?pomiar. */
export const TRACK_DOM_EVENT = "taktyl:track";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

// Zasada 5 (docs/10 §1): obrona w glebi, gdyby ktos dopisal pole osobowe poza typami.
const PERSONAL_KEY =
  /^(e_?mail|phone|telefon|first_?name|last_?name|imie|nazwisko|address|adres|nip|tel)$/i;

function stripPersonal<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripPersonal) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!PERSONAL_KEY.test(k)) out[k] = stripPersonal(v);
    }
    return out as T;
  }
  return value;
}

function debugEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("pomiar");
  } catch {
    return false;
  }
}

/**
 * Wysyla zdarzenie do dataLayer (docs/10 §6). Parametry z `items` ida w `ecommerce` i sa poprzedzone
 * `{ ecommerce: null }`. Pierwsze przeciazenie pilnuje nazw i parametrow z docs/10; drugie to zgodnosc wsteczna
 * ze stubem (nazwa luzna).
 */
export function track<E extends TrackEventName>(event: E, params?: TrackEventMap[E]): void;
export function track(event: string, params?: TrackParams): void;
export function track(event: string, params: TrackParams = {}): void {
  if (typeof window === "undefined") return;
  try {
    const clean = stripPersonal(params);
    const dl = (window.dataLayer = window.dataLayer ?? []);
    const hasItems = Boolean(clean.items);
    if (hasItems) dl.push({ ecommerce: null }); // czyszczenie poprzedniego obiektu (docs/10 §6)
    const payload = hasItems ? { event, ecommerce: clean } : { event, ...clean };
    dl.push(payload);
    if (debugEnabled()) window.dispatchEvent(new CustomEvent(TRACK_DOM_EVENT, { detail: payload }));
  } catch {
    /* pomiar nigdy nie zrywa strony */
  }
}

const TRACKED_KEY = "taktyl.tracked.v1";
const TRACKED_MAX = 50;

function readTracked(): string[] {
  try {
    const parsed: unknown = JSON.parse(readItem("local", TRACKED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * docs/10 §1 zasada 3: `purchase` raz na `transaction_id` (lista w `taktyl.tracked.v1`). Odswiezenie potwierdzenia
 * nie liczy drugi raz. Zwraca true, gdy zdarzenie poszlo; false, gdy ten numer juz byl liczony.
 */
export function trackPurchaseOnce(params: TrackEventMap["purchase"]): boolean {
  const seen = readTracked();
  if (seen.includes(params.transaction_id)) return false;
  writeItem(
    "local",
    TRACKED_KEY,
    JSON.stringify([...seen, params.transaction_id].slice(-TRACKED_MAX)),
  );
  track("purchase", params);
  return true;
}

/** Obiekt produktu w `items[]` (docs/10 §3), wersja ze stubu: pozycja poza setem (discount 0). */
export type TrackItemInput = TrackLineSource;

export function trackItem(i: TrackItemInput): Record<string, unknown> {
  return { ...buildItem(i) };
}

export type { TrackEventMap, TrackEventName } from "./track-events";
