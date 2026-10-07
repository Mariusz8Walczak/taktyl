// F-240, F-242 (docs/10 §2): tryb zgody i decyzja uzytkownika. Fragment `default: denied` stoi w <head>
// (bootstrap.ts), tu jest zapis decyzji, `consent update` i warunkowe zaladowanie menedzera tagow.
// Wzorzec: baner cookies - wlasny (docs/08, szablon nie ma odpowiednika).
import { readItem, writeItem } from "../storage/safe-storage";

export const CONSENT_KEY = "taktyl.consent.v1";
/** Zdarzenie okna: zmiana decyzji (baner i stopka sie synchronizuja). */
export const CONSENT_CHANGED_EVENT = "taktyl:consent";
/** Zdarzenie okna: stopka prosi o ponowne otwarcie ustawien. */
export const CONSENT_OPEN_EVENT = "taktyl:consent-open";

export interface ConsentChoice {
  analytics: boolean;
  marketing: boolean;
}
export interface ConsentRecord extends ConsentChoice {
  v: 1;
  /** ISO 8601 (UTC); data decyzji. */
  at: string;
}

export const ACCEPT_ALL: ConsentChoice = { analytics: true, marketing: true };
export const NECESSARY_ONLY: ConsentChoice = { analytics: false, marketing: false };

function dataLayer(): Record<string, unknown>[] {
  window.dataLayer = window.dataLayer ?? [];
  return window.dataLayer;
}

/** gtag musi wkladac do dataLayer obiekt `arguments` (tak czyta go GTM), nie tablice. */
export function gtag(..._args: unknown[]): void {
  // eslint-disable-next-line prefer-rest-params
  dataLayer().push(arguments as unknown as Record<string, unknown>);
}

/** Mapowanie kategorii na sygnaly trybu zgody (docs/10 §2): tylko zaakceptowane kategorie sa `granted`. */
export function consentSignals(choice: ConsentChoice): Record<string, "granted" | "denied"> {
  const marketing = choice.marketing ? "granted" : "denied";
  return {
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
    analytics_storage: choice.analytics ? "granted" : "denied",
  };
}

export function readConsent(): ConsentRecord | null {
  try {
    const raw = readItem("local", CONSENT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ConsentRecord>;
    if (p.v !== 1 || typeof p.at !== "string") return null;
    return { v: 1, at: p.at, analytics: p.analytics === true, marketing: p.marketing === true };
  } catch {
    return null;
  }
}

let gtmLoaded = false;

/** Laduje kontener GTM (jedyna obca domena; tylko gdy ustawiono PUBLIC_GTM_ID i jest zgoda analityczna). */
export function loadGtm(id: string | undefined): boolean {
  if (!id || gtmLoaded || typeof document === "undefined") return false;
  if (!/^GTM-[A-Z0-9]+$/.test(id)) return false;
  if (!readConsent()?.analytics) return false;
  gtmLoaded = true;
  dataLayer().push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  return true;
}

/** Do testow. */
export function resetConsentRuntime(): void {
  gtmLoaded = false;
}

/** Zapisuje decyzje (pamiec + localStorage w try/catch), wysyla `consent update` i laduje GTM, jesli wolno. */
export function saveConsent(
  choice: ConsentChoice,
  gtmId?: string,
  now: Date = new Date(),
): ConsentRecord {
  const record: ConsentRecord = {
    v: 1,
    at: now.toISOString(),
    analytics: choice.analytics,
    marketing: choice.marketing,
  };
  writeItem("local", CONSENT_KEY, JSON.stringify(record));
  gtag("consent", "update", consentSignals(choice));
  loadGtm(gtmId);
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: record }));
  return record;
}

export function openConsentSettings(): void {
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
}
