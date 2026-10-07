"use client";
// F-004, wzorzec: menu mobilne = szuflada z lewej (docs/08), modul nakladek @taktyl/ui (A-12). TAKTYL-77: tu zostaje
// przycisk "Menu"; szuflada (Drawer + lista) to leniwy modul mobile-menu-drawer.tsx, ladowany przy pierwszym
// najechaniu, fokusie lub dotknieciu przycisku.
import { usePathname } from "next/navigation";
import { Suspense, lazy, useEffect, useRef, useState } from "react";

const loadDrawer = () => import("./mobile-menu-drawer");
const MobileMenuDrawer = lazy(loadDrawer);

/** Punkt przelamania Bootstrapa 5 (docs/06 §4): od 992 px nawigacja jest w naglowku, menu mobilne znika. */
const DESKTOP_QUERY = "(min-width: 992px)";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  // szuflada zostaje zamontowana po pierwszym uzyciu (animacja zamkniecia, powrot fokusu)
  const [used, setUsed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // zmiana adresu zamyka szuflade (nawigacja w obrebie aplikacji nie przeladowuje strony)
  useEffect(() => setOpen(false), [pathname]);

  // powiekszenie okna do ukladu komputerowego zamyka szuflade, zeby nie zostawic blokady przewijania
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="naglowek__link naglowek__menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        onPointerEnter={() => void loadDrawer()}
        onFocus={() => void loadDrawer()}
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
      >
        Menu
      </button>
      {used ? (
        <Suspense fallback={null}>
          <MobileMenuDrawer open={open} onClose={close} returnFocusRef={buttonRef} />
        </Suspense>
      ) : null}
    </>
  );
}
