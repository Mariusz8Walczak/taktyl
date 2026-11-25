"use client";
// F-005 (wyszukiwarka z podpowiedziami), F-242 (zdarzenie `search`, w search-dialog.tsx).
// Wzorzec: okno wyszukiwania szablonu (docs/08 §6). TAKTYL-77: w bazie JS strony zostaje tylko odnosnik "Szukaj"
// (nadal <a href="/szukaj">, dziala bez JS); okno z podpowiedziami (Dialog, pole, listbox, fetch) laduje sie
// przy pierwszym najechaniu, fokusie lub kliknieciu (React.lazy). Skrot "/" (TAKTYL-59) wywola OPEN_SEARCH_EVENT.
import { Kbd } from "@taktyl/ui";
import Link from "next/link";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { SEARCH_LINK } from "../../lib/nav";
import { OPEN_SEARCH_EVENT } from "../../lib/shortcuts/events";

/** Hak dla skrotu "/" (TAKTYL-59): `window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))` otwiera wyszukiwarke. */
export { OPEN_SEARCH_EVENT };

const loadDialog = () => import("./search-dialog");
const SearchDialog = lazy(loadDialog);

export function SearchBox() {
  const [open, setOpen] = useState(false);
  // okno zostaje zamontowane po pierwszym uzyciu (animacja zamkniecia, powrot fokusu)
  const [used, setUsed] = useState(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  // Audyt UX: przy pierwszym otwarciu okno laduje sie leniwie, a klient juz pisze. Znaki wpisane w tym czasie trafiaja
  // do bufora i do pola, gdy okno jest gotowe (wczesniej ginely - "pierwsza proba nie trafila do pola").
  const buffer = useRef("");
  const capture = useRef<((e: KeyboardEvent) => void) | null>(null);
  const loaded = useRef(false);

  const stopCapture = () => {
    if (capture.current) document.removeEventListener("keydown", capture.current, true);
    capture.current = null;
  };

  const show = () => {
    setUsed(true);
    setOpen(true);
    if (loaded.current || capture.current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        stopCapture();
        return;
      }
      if (e.key === "Backspace") buffer.current = buffer.current.slice(0, -1);
      else if (e.key.length === 1 && !(buffer.current === "" && e.key === "/"))
        buffer.current += e.key;
      else return;
      e.preventDefault();
    };
    capture.current = onKey;
    document.addEventListener("keydown", onKey, true);
  };

  /** Okno gotowe: oddaje znaki z bufora i konczy przechwytywanie. */
  const takeBuffered = () => {
    loaded.current = true;
    stopCapture();
    const s = buffer.current;
    buffer.current = "";
    return s;
  };

  useEffect(() => {
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
      stopCapture();
    };
  }, []);

  return (
    <>
      <Link
        ref={triggerRef}
        href={SEARCH_LINK.href}
        className="naglowek__link"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={() => void loadDialog()}
        onFocus={() => void loadDialog()}
        onClick={(e) => {
          e.preventDefault();
          show();
        }}
      >
        <span>{SEARCH_LINK.label}</span>
        <Kbd aria-hidden="true" className="naglowek__skrot">
          /
        </Kbd>
      </Link>
      {used ? (
        <Suspense fallback={null}>
          <SearchDialog
            open={open}
            onClose={() => setOpen(false)}
            returnFocusRef={triggerRef}
            takeBuffered={takeBuffered}
          />
        </Suspense>
      ) : null}
    </>
  );
}
