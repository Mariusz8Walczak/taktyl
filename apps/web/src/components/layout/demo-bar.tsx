"use client";
// F-001, wzorzec: pasek informacyjny nad naglowkiem (docs/05 §2 poz. 1: "wlasny, prosty"). Tekst z API
// (demo.label). Audyt (pasek demo wraca na kazdej stronie): zamkniecie pamietane w localStorage przez
// DEMO_BAR_DAYS dni (try/catch, zapas w pamieci) - regula 10 dalej spelniona: informacja o demo zostaje w stopce,
// a strona ma noindex. Bez migania: skrypt DemoBarScript ustawia atrybut na <html> przed pierwszym malowaniem,
// a CSS chowa pasek; ten komponent po hydracji tylko zgadza stan React z tym atrybutem.
import { useEffect, useState } from "react";
import { readItem, writeItem } from "../../lib/storage/safe-storage";

export const DEMO_BAR_KEY = "taktyl.demobar.v1";
export const DEMO_BAR_ATTR = "data-pasek-demo";
/** Po tylu dniach pasek wraca (zmiany w sklepie demo warto znowu zapowiedziec). */
export const DEMO_BAR_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Wartosc zapisu: "closed:<ms>"; dawny zapis sesyjny "closed" tez sie liczy (do konca sesji). */
export function demoBarClosed(value: string | null, now: number = Date.now()): boolean {
  if (value === "closed") return true;
  const m = /^closed:(\d+)$/.exec(value ?? "");
  return m ? now - Number(m[1]) < DEMO_BAR_DAYS * DAY_MS : false;
}

/** Tresc skryptu wstawianego na poczatku body (bez odwolan do zewnetrznych domen). */
export const DEMO_BAR_SCRIPT = `try{var k=${JSON.stringify(DEMO_BAR_KEY)},v=localStorage.getItem(k),m=/^closed:(\\d+)$/.exec(v||"");if((m&&Date.now()-Number(m[1])<${DEMO_BAR_DAYS * DAY_MS})||sessionStorage.getItem(k)==="closed")document.documentElement.setAttribute(${JSON.stringify(DEMO_BAR_ATTR)},"closed")}catch(e){}`;

export function DemoBar({ label }: { label: string }) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (
      demoBarClosed(readItem("local", DEMO_BAR_KEY)) ||
      readItem("session", DEMO_BAR_KEY) === "closed"
    )
      setClosed(true);
  }, []);

  if (closed) return null;

  const close = () => {
    writeItem("local", DEMO_BAR_KEY, `closed:${Date.now()}`);
    document.documentElement.setAttribute(DEMO_BAR_ATTR, "closed");
    setClosed(true);
  };

  return (
    <div className="pasek-demo sekcja--mod" data-testid="pasek-demo">
      <div className="kontener pasek-demo__wnetrze">
        <p className="pasek-demo__tekst">{label}</p>
        <button type="button" className="pasek-demo__zamknij" onClick={close}>
          Zamknij
        </button>
      </div>
    </div>
  );
}
