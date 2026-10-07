"use client";
// F-240 (baner zgod), F-242 (tryb zgody): wlasny komponent, szablon nie ma odpowiednika (docs/08 §6).
// - Baner to dolny pasek (<= 40% wysokosci, `--zgody-maks`), NIE modalny: nie zaslania glownego przycisku pierwszego
//   ekranu i nie kradnie fokusu; stoi w DOM tuz za linkiem "Przejdz do tresci", wiec Tab dociera do niego pierwszy.
// - "Akceptuje wszystkie" i "Tylko niezbedne" to ten sam wariant przycisku (poboczny), ten sam rozmiar.
// - "Ustawienia" otwiera Dialog z @taktyl/ui (pulapka fokusu, Esc) z kategoriami; do stopki: "Ustawienia cookies".
import { Button, Dialog, TextButton } from "@taktyl/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ACCEPT_ALL,
  CONSENT_OPEN_EVENT,
  NECESSARY_ONLY,
  loadGtm,
  readConsent,
  saveConsent,
} from "../../lib/consent/consent";
import type { ConsentChoice } from "../../lib/consent/consent";

type Mode = "closed" | "banner" | "settings";

function Category({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="zgody__kategoria">
      <input
        id={id}
        type="checkbox"
        className="zgody__pole"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-opis`}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <div>
        <label htmlFor={id} className="zgody__etykieta">
          {label}
        </label>
        <p id={`${id}-opis`} className="zgody__opis">
          {hint}
        </p>
      </div>
    </div>
  );
}

export function ConsentManager({ gtmId }: { gtmId?: string }) {
  const [mode, setMode] = useState<Mode>("closed");
  const [draft, setDraft] = useState<ConsentChoice>(NECESSARY_ONLY);
  const barRef = useRef<HTMLElement>(null);
  const uid = useId();

  useEffect(() => {
    const record = readConsent();
    if (record) loadGtm(gtmId);
    else setMode("banner");
  }, [gtmId]);

  useEffect(() => {
    const open = () => {
      const record = readConsent();
      setDraft(
        record ? { analytics: record.analytics, marketing: record.marketing } : NECESSARY_ONLY,
      );
      setMode("settings");
    };
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  // Rezerwacja miejsca pod paskiem (docs/11 pulapka 26): scroll-padding-bottom i odstep na dole strony.
  useEffect(() => {
    const el = barRef.current;
    if (mode !== "banner" || !el) return;
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
  }, [mode]);

  const decide = useCallback(
    (choice: ConsentChoice) => {
      saveConsent(choice, gtmId);
      setMode("closed");
    },
    [gtmId],
  );

  const closeSettings = () => setMode(readConsent() ? "closed" : "banner");

  return (
    <>
      {mode === "banner" ? (
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
            onClick={() => {
              setDraft(NECESSARY_ONLY);
              setMode("settings");
            }}
          >
            Ustawienia
          </TextButton>
        </section>
      ) : null}
      <Dialog
        open={mode === "settings"}
        onClose={closeSettings}
        title="Ustawienia cookies"
        footer={
          <Button variant="primary" onClick={() => decide(draft)}>
            Zapisz wybór
          </Button>
        }
      >
        <p className="zgody__opis">
          Wybierz, na co się zgadzasz. Zmienisz to w każdej chwili w stopce: „Ustawienia cookies”.
        </p>
        <Category
          id={`${uid}-niezbedne`}
          label="Niezbędne"
          hint="Koszyk, wybór ustawień i ta decyzja. Bez nich sklep nie działa, więc nie można ich wyłączyć."
          checked
          disabled
        />
        <Category
          id={`${uid}-analityka`}
          label="Analityczne"
          hint="Pomiar ruchu i ścieżki zakupowej, bez danych osobowych."
          checked={draft.analytics}
          onChange={(analytics) => setDraft((d) => ({ ...d, analytics }))}
        />
        <Category
          id={`${uid}-marketing`}
          label="Marketingowe"
          hint="Dopasowanie reklam poza sklepem."
          checked={draft.marketing}
          onChange={(marketing) => setDraft((d) => ({ ...d, marketing }))}
        />
      </Dialog>
    </>
  );
}
