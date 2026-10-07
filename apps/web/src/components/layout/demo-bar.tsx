"use client";
// F-001, wzorzec: pasek informacyjny nad naglowkiem (docs/05 §2 poz. 1: "wlasny, prosty"). Tekst z API
// (demo.label). Zamkniecie na sesje: sessionStorage w try/catch z zapasem w pamieci. Bez migania: skrypt
// DemoBarScript ustawia atrybut na <html> przed pierwszym malowaniem, a CSS chowa pasek; ten komponent
// po hydracji tylko zgadza stan React z tym atrybutem.
import { useEffect, useState } from "react";
import { readItem, writeItem } from "../../lib/storage/safe-storage";

export const DEMO_BAR_KEY = "taktyl.demobar.v1";
export const DEMO_BAR_ATTR = "data-pasek-demo";

/** Tresc skryptu wstawianego na poczatku body (bez odwolan do zewnetrznych domen). */
export const DEMO_BAR_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(DEMO_BAR_KEY)})==="closed")document.documentElement.setAttribute(${JSON.stringify(DEMO_BAR_ATTR)},"closed")}catch(e){}`;

export function DemoBar({ label }: { label: string }) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (readItem("session", DEMO_BAR_KEY) === "closed") setClosed(true);
  }, []);

  if (closed) return null;

  const close = () => {
    writeItem("session", DEMO_BAR_KEY, "closed");
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
