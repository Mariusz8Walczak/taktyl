// F-242 (docs/10, ADR-0012, B-621): wysylka zdarzen pomiaru do wlasnego kolektora `POST {API}/v1/events`.
// - TYLKO po zgodzie na analityke (taktyl.consent.v1 -> analytics: true); bez zgody nic nie wychodzi z przegladarki.
// - Nazwy i parametry bez zmian (te same obiekty co w dataLayer, po usunieciu pol osobowych w track.ts).
// - Paczki po maks. EVENTS_BATCH_MAX zdarzen: { session_id, events: [{ name, params, ts }] }; wysylka co FLUSH_MS albo
//   po zapelnieniu paczki, a przy zamknieciu/ukryciu karty `fetch(keepalive)` z zapasem `navigator.sendBeacon`.
// - session_id: losowy, anonimowy, w sessionStorage (konczy sie z karta); nie identyfikuje osoby ani urzadzenia.
// - Wysylka prosto z przegladarki na API (limit zadan liczony per klient, nie per serwer Next); adres API z <meta>.
// - Bledy (brak endpointu, siec, 4xx/5xx) sa ciche: pomiar nigdy nie psuje strony.
import { readConsent } from "./consent/consent";
import { readItem, writeItem } from "./storage/safe-storage";

/** docs/10 §4 i §5 (zgodnie z kontraktem kolektora, packages/contracts events): inne nazwy nie sa wysylane. */
export const COLLECTED_EVENTS: ReadonlySet<string> = new Set([
  "view_item_list",
  "select_item",
  "view_item",
  "add_to_wishlist",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "add_shipping_info",
  "add_payment_info",
  "purchase",
  "search",
  "set_builder_start",
  "set_profile_select",
  "set_step_complete",
  "set_fit_warning",
  "set_suggestion_apply",
  "set_complete",
  "set_share",
  "set_save",
  "set_add_to_cart",
  "filter_apply",
  "compare_add",
  "shortcut_use",
  "payment_failed",
  "generate_lead",
  "return_request",
]);

export const EVENTS_BATCH_MAX = 20;
export const FLUSH_MS = 5000;
export const SESSION_KEY = "taktyl.pomiar.sesja.v1";
/** <meta name="taktyl:api" content="http://api.taktyl.localhost"> z layoutu (PUBLIC_API_URL). */
export const API_META = "taktyl:api";

export interface CollectedEvent {
  name: string;
  params: Record<string, unknown>;
  ts: string;
}

let queue: CollectedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function apiBase(): string | null {
  try {
    const v = document.querySelector<HTMLMetaElement>(`meta[name="${API_META}"]`)?.content ?? "";
    return v ? v.replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

function randomId(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Anonimowy identyfikator sesji (8-64 znaki [A-Za-z0-9_-]); w sessionStorage albo w pamieci. */
export function sessionId(): string {
  const stored = readItem("session", SESSION_KEY);
  if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
  const id = randomId();
  writeItem("session", SESSION_KEY, id);
  return id;
}

function analyticsAllowed(): boolean {
  try {
    return readConsent()?.analytics === true;
  } catch {
    return false;
  }
}

function send(batch: CollectedEvent[], unloading: boolean): void {
  const base = apiBase();
  if (!base || batch.length === 0) return;
  const url = `${base}/v1/events`;
  const body = JSON.stringify({ session_id: sessionId(), events: batch });
  try {
    const p = fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      mode: "cors",
      credentials: "omit",
      keepalive: unloading,
    });
    p.catch(() => undefined);
  } catch {
    // keepalive niedostepny (albo przekroczony limit): ostatnia szansa przez sendBeacon
    try {
      if (unloading) navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }));
    } catch {
      /* cicho */
    }
  }
}

/** Wysyla wszystko z kolejki paczkami po EVENTS_BATCH_MAX. */
export function flushEvents(unloading = false): void {
  if (timer) clearTimeout(timer);
  timer = null;
  while (queue.length > 0) send(queue.splice(0, EVENTS_BATCH_MAX), unloading);
}

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("pagehide", () => flushEvents(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushEvents(true);
  });
}

/** Wolane przez track() dla kazdego zdarzenia; bez zgody na analityke i dla nazw spoza docs/10 - nic. */
export function collectEvent(name: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined" || !COLLECTED_EVENTS.has(name) || !analyticsAllowed()) return;
  queue.push({ name, params, ts: new Date().toISOString() });
  listen();
  if (queue.length >= EVENTS_BATCH_MAX) flushEvents();
  else if (!timer) timer = setTimeout(() => flushEvents(), FLUSH_MS);
}

/** Tylko do testow. */
export function resetCollector(): void {
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
}
