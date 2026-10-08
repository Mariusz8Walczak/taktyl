"use client";
// F-240 (baner zgod), F-242 (tryb zgody). Wzorzec: wlasny komponent, szablon nie ma odpowiednika (docs/08 §6).
// - Baner to dolny pasek (<= 40% wysokosci, `--zgody-maks`), NIE modalny: nie zaslania glownego przycisku pierwszego
//   ekranu i nie kradnie fokusu; stoi w DOM tuz za linkiem "Przejdz do tresci", wiec Tab dociera do niego pierwszy.
// - "Akceptuje wszystkie" i "Tylko niezbedne" to ten sam wariant przycisku (poboczny), ten sam rozmiar.
// - "Ustawienia" otwiera Dialog z kategoriami (consent-ui.tsx, ladowany leniwie); do stopki: "Ustawienia cookies".
// TAKTYL-84: baner jest renderowany na serwerze (stan domyslny "brak decyzji" jest w HTML od pierwszego bajtu), wiec
// jego tekst maluje sie razem z reszta pierwszego ekranu i nie jest elementem LCP pojawiajacym sie po hydracji.
// Powracajacy uzytkownik: skrypt trybu zgody w <head> ustawia html[data-zgody-zapisane] jeszcze przed pierwszym
// malowaniem (zgody.css chowa wtedy baner, bez mrugniecia), a po hydracji baner jest zdejmowany z drzewa.
// Baner jest `position: fixed`, wiec nie przesuwa ukladu (CLS 0); rezerwacje miejsca pod paskiem robi efekt ponizej.
import { Button, TextButton } from "@taktyl/ui";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import {
  ACCEPT_ALL,
  CONSENT_OPEN_EVENT,
  NECESSARY_ONLY,
  loadGtm,
  readConsent,
  saveConsent,
} from "../../lib/consent/consent";
import type { ConsentChoice } from "../../lib/consent/consent";

const ConsentUi = lazy(() => import("./consent-ui"));

export function ConsentManager({ gtmId }: { gtmId?: string }) {
  // true = brak decyzji (stan domyslny dla HTML z serwera); po hydracji korygowany odczytem localStorage
  const [bannerOpen, setBannerOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (readConsent()) {
      loadGtm(gtmId);
      setBannerOpen(false);
    }
  }, [gtmId]);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  const showBanner = bannerOpen && !settingsOpen;

  // Rezerwacja miejsca pod paskiem (docs/11 pulapka 26): scroll-padding-bottom i odstep na dole strony.
  useEffect(() => {
    const el = barRef.current;
    if (!showBanner || !el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--zgody-wys", `${el.offsetHeight}px`);
    sync();
    root.dataset.zgody = "otwarte";
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty("--zgody-wys");
      delete root.dataset.zgody;
    };
  }, [showBanner]);

  const decide = useCallback(
    (choice: ConsentChoice) => {
      saveConsent(choice, gtmId);
      setBannerOpen(false);
      setSettingsOpen(false);
    },
    [gtmId],
  );

  return (
    <>
      {showBanner ? (
        <section ref={barRef} className="zgody" aria-label="Zgody na pliki cookies">
          <p className="zgody__tekst">
            Sklep demonstracyjny zapamiętuje w przeglądarce koszyk i ustawienia. Pomiar ruchu i
            marketing włączymy tylko za Twoją zgodą.
          </p>
          <div className="zgody__przyciski">
            <Button variant="secondary" onClick={() => decide(ACCEPT_ALL)}>
              Akceptuję wszystkie
            </Button>
            <Button variant="secondary" onClick={() => decide(NECESSARY_ONLY)}>
              Tylko niezbędne
            </Button>
          </div>
          <TextButton
            className="zgody__ustawienia"
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen(true)}
          >
            Ustawienia
          </TextButton>
        </section>
      ) : null}
      {settingsOpen ? (
        <Suspense fallback={null}>
          <ConsentUi
            gtmId={gtmId}
            onDecided={() => {
              setBannerOpen(false);
              setSettingsOpen(false);
            }}
            onClose={() => setSettingsOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
