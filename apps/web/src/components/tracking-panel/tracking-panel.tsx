"use client";
// F-243 (TAKTYL-60; wzorzec: panel boczny/szuflada z szablonu, docs/08): panel podgladu zdarzen pomiaru pod `?pomiar=1`.
// Wysuwany z prawej krawedzi (position: fixed + translateX, wiec bez wplywu na uklad i CLS), nasluchuje `taktyl:track`
// (docs/10 §6), pokazuje nazwe, godzine (Europe/Warsaw) i parametry w JSON oraz wpisy zgody (consent default/update)
// z dataLayer. "Wyczyść" i "Kopiuj jako JSON" (Clipboard API z zapasem). Dostepny z klawiatury: przycisk z
// aria-expanded, Esc zamyka i oddaje fokus przyciskowi. Nie jest nakladka modalna (nie przechwytuje fokusu).
import { Button } from "@taktyl/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  consentEntry,
  copyText,
  domEventEntry,
  entriesToJson,
  formatTime,
  prettyPayload,
  seedFromDataLayer,
  type TrackEntry,
} from "../../lib/tracking-panel/entries";
import { TRACK_DOM_EVENT } from "../../lib/track";

const MAX_ENTRIES = 300;

type CopyState = "idle" | "ok" | "fail";

export function TrackingPanel() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<TrackEntry[]>(() =>
    typeof window === "undefined" ? [] : seedFromDataLayer(window.dataLayer),
  );
  const [copy, setCopy] = useState<CopyState>("idle");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const push = useCallback((entry: TrackEntry | null) => {
    if (entry) setEntries((prev) => [...prev, entry].slice(-MAX_ENTRIES));
  }, []);

  useEffect(() => {
    const onTrack = (e: Event) => push(domEventEntry((e as CustomEvent).detail, Date.now()));
    window.addEventListener(TRACK_DOM_EVENT, onTrack);
    // zgoda: gtag('consent', ...) laduje do dataLayer jako `arguments`, bez zdarzenia DOM - lapiemy je przy push
    const layer = (window.dataLayer = window.dataLayer ?? []);
    const original = layer.push;
    layer.push = (...items: Record<string, unknown>[]) => {
      for (const item of items) push(consentEntry(item, Date.now()));
      return original.apply(layer, items);
    };
    return () => {
      window.removeEventListener(TRACK_DOM_EVENT, onTrack);
      layer.push = original;
    };
  }, [push]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, entries.length]);

  const onCopy = async () => {
    setCopy((await copyText(entriesToJson(entries))) ? "ok" : "fail");
  };

  return (
    <div className="pomiar" data-testid="panel-pomiaru">
      <button
        ref={toggleRef}
        type="button"
        className="tk-btn tk-btn--poboczny pomiar__przycisk"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        Podgląd zdarzeń ({entries.length})
      </button>
      <section
        id={panelId}
        className="pomiar__panel"
        aria-label="Podgląd zdarzeń pomiaru"
        hidden={!open}
      >
        <div className="pomiar__naglowek">
          <h2 className="pomiar__tytul">Podgląd zdarzeń</h2>
          <div className="pomiar__akcje">
            <Button
              variant="secondary"
              onClick={() => {
                setEntries([]);
                setCopy("idle");
              }}
            >
              Wyczyść
            </Button>
            <Button variant="secondary" onClick={() => void onCopy()}>
              Kopiuj jako JSON
            </Button>
          </div>
          <p className="pomiar__stan" role="status">
            {copy === "ok" ? "Skopiowano do schowka." : null}
            {copy === "fail" ? "Nie udało się skopiować. Zaznacz tekst ręcznie." : null}
          </p>
        </div>
        {entries.length === 0 ? (
          <p className="pomiar__pusto">Brak zdarzeń. Korzystaj ze sklepu, a pojawią się tutaj.</p>
        ) : (
          <ol ref={listRef} className="lista pomiar__lista" aria-label="Zdarzenia">
            {entries.map((e) => (
              <li key={e.id} className="pomiar__wpis">
                <p className="pomiar__nazwa">
                  <strong>{e.name}</strong> <time className="pomiar__czas">{formatTime(e.at)}</time>
                </p>
                <pre className="pomiar__json" tabIndex={0}>
                  {prettyPayload(e.payload)}
                </pre>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
