"use client";
// F-005 (wyszukiwarka z podpowiedziami), F-242 (zdarzenie `search`, w search-dialog.tsx).
// Wzorzec: okno wyszukiwania szablonu (docs/08 §6). TAKTYL-77: w bazie JS strony zostaje tylko odnosnik "Szukaj"
// (nadal <a href="/szukaj">, dziala bez JS); okno z podpowiedziami (Dialog, pole, listbox, fetch) laduje sie
// przy pierwszym najechaniu, fokusie lub kliknieciu (React.lazy). Skrot "/" (TAKTYL-59) wywola OPEN_SEARCH_EVENT.
import { Kbd } from "@taktyl/ui";
import Link from "next/link";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { SEARCH_LINK } from "../../lib/nav";

/** Hak dla skrotu "/" (TAKTYL-59): `window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))` otwiera wyszukiwarke. */
export const OPEN_SEARCH_EVENT = "taktyl:open-search";

const loadDialog = () => import("./search-dialog");
const SearchDialog = lazy(loadDialog);

export function SearchBox() {
  const [open, setOpen] = useState(false);
  // okno zostaje zamontowane po pierwszym uzyciu (animacja zamkniecia, powrot fokusu)
  const [used, setUsed] = useState(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);

  const show = () => {
    setUsed(true);
    setOpen(true);
  };

  useEffect(() => {
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, show);
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
          <SearchDialog open={open} onClose={() => setOpen(false)} returnFocusRef={triggerRef} />
        </Suspense>
      ) : null}
    </>
  );
}
