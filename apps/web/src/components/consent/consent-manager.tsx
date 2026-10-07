"use client";
// F-240 (baner zgod), F-242 (tryb zgody). Wzorzec: wlasny komponent, szablon nie ma odpowiednika (docs/08 §6).
// TAKTYL-77: w bazie JS strony zostaje tylko odczyt zapisanej decyzji i nasluch zdarzenia otwarcia ustawien;
// UI (baner, Dialog z kategoriami) to leniwy modul consent-ui.tsx, ladowany po hydracji, gdy nie ma decyzji,
// albo na zadanie ("Ustawienia cookies" w stopce). Baner jest `position: fixed`, wiec jego pojawienie sie
// nie przesuwa ukladu (CLS 0); rezerwacje miejsca pod paskiem robi consent-ui.
import { Suspense, lazy, useEffect, useState } from "react";
import { CONSENT_OPEN_EVENT, loadGtm, readConsent } from "../../lib/consent/consent";

const ConsentUi = lazy(() => import("./consent-ui"));

export function ConsentManager({ gtmId }: { gtmId?: string }) {
  const [initial, setInitial] = useState<"banner" | "settings" | null>(null);

  useEffect(() => {
    if (readConsent()) loadGtm(gtmId);
    else setInitial((current) => current ?? "banner");
  }, [gtmId]);

  useEffect(() => {
    // pierwsze otwarcie ustawien przed zaladowaniem UI: UI startuje od razu z oknem ustawien
    const open = () => setInitial((current) => current ?? "settings");
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  if (!initial) return null;
  return (
    <Suspense fallback={null}>
      <ConsentUi gtmId={gtmId} initial={initial} />
    </Suspense>
  );
}
