"use client";
// F-004, wzorzec: menu mobilne = szuflada z lewej (koszyk wyskakujacy / okna szablonu, docs/08), modul nakladek
// @taktyl/ui (A-12): pulapka fokusu, Esc, tlo, powrot fokusu na przycisk menu, 100dvh.
import { Drawer } from "@taktyl/ui";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COMPARE_LINK, NAV_MAIN, SEARCH_LINK, WISHLIST_LINK } from "../../lib/nav";
import { NavLink } from "./nav-link";

/** Punkt przelamania Bootstrapa 5 (docs/06 §4): od 992 px nawigacja jest w naglowku, menu mobilne znika. */
const DESKTOP_QUERY = "(min-width: 992px)";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
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
        onClick={() => setOpen(true)}
      >
        Menu
      </button>
      <Drawer side="left" open={open} onClose={close} title="Menu" returnFocusRef={buttonRef}>
        <nav aria-label="Menu główne">
          <ul className="lista">
            {NAV_MAIN.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} className="menu-mobilne__link" onClick={close}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Narzędzia" className="menu-mobilne__dodatkowe">
          <ul className="lista">
            {[SEARCH_LINK, WISHLIST_LINK, COMPARE_LINK].map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} className="menu-mobilne__link" onClick={close}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </Drawer>
    </>
  );
}
