"use client";
// TAKTYL-67: kontroler ladowany po hydracji przez shortcuts-host.tsx (poza baza JS stron, docs/12 par. 4).
// F-010, A-17 (wzorzec: okno wyszukiwania i lista skrotow szablonu, docs/08 §6): globalny nasluch skrotow.
// "/" otwiera wyszukiwarke (zdarzenie `taktyl:open-search`), "?" pokazuje liste skrotow (okno ladowane leniwie,
// budzet JS docs/12 §4), Esc zamyka nakladki (obsluguja je same; tu tylko pomiar i zamykanie menu kategorii).
// Skrot nie dziala z modyfikatorem, w polu tekstowym ani gdy uzytkownik go wylaczyl (WCAG 2.1.4, `taktyl.prefs.v1`).
// Przycisk "Skróty klawiszowe" w stopce to zwykly <button data-otworz-skroty> (delegacja, bez wyspy w stopce).
// Ten sam efekt uruchamia leniwy panel podgladu zdarzen pod `?pomiar` (F-243).
import { usePathname } from "next/navigation";
import { Suspense, lazy, useEffect, useState } from "react";
import {
  OPEN_SEARCH_EVENT,
  OPEN_SHORTCUTS_EVENT,
  pressKbd,
  trackShortcut,
} from "../../lib/shortcuts/events";
import { isEditableTarget, matchShortcut, overlayOpen } from "../../lib/shortcuts/keys";
import { shortcutsEnabled } from "../../lib/shortcuts/prefs";
import { maybeLoadTrackingPanel } from "../tracking-panel/loader";

const loadDialog = () => import("./shortcuts-dialog");
const ShortcutsDialog = lazy(loadDialog);

/**
 * F-003, audyt P1-10: menu kategorii (CSS :hover i fokus z klawiatury) zamkniete do czasu wyjscia kursora albo fokusu
 * z pozycji: po Esc (WCAG 1.4.13), po kliknieciu odnosnika i po zmianie trasy.
 */
function suspendCategoryMenu(item: Element): void {
  if (item.hasAttribute("data-zamkniete")) return;
  const reopen = (e: Event) => {
    if (!(e instanceof FocusEvent) || !item.contains(e.relatedTarget as Node | null)) {
      item.removeAttribute("data-zamkniete");
      item.removeEventListener("focusout", reopen);
      item.removeEventListener("pointerleave", reopen);
    }
  };
  item.setAttribute("data-zamkniete", "");
  item.addEventListener("focusout", reopen);
  item.addEventListener("pointerleave", reopen);
}

/** Esc: zamyka panel, fokus wraca na odnosnik kategorii. */
function closeCategoryMenu(): void {
  const item = document.activeElement?.closest(".menu-kat__pozycja");
  if (!item) return;
  suspendCategoryMenu(item);
  item.querySelector<HTMLElement>(".menu-kat__link")?.focus();
}

export default function ShortcutsController() {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);

  useEffect(() => {
    const show = () => {
      setUsed(true);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (overlayOpen()) trackShortcut("esc");
        else closeCategoryMenu();
        return;
      }
      const key = matchShortcut(e);
      if (!key || !shortcutsEnabled() || isEditableTarget(e.target) || overlayOpen()) return;
      e.preventDefault();
      trackShortcut(key);
      if (key === "/") {
        pressKbd(document, "/"); // A-17
        window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
      } else {
        show();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-otworz-skroty]")) show();
      // Audyt P1-10: klikniecie odnosnika w menu kategorii zamyka panel (nie wisi nad trescia przy przewijaniu)
      const menuItem = target?.closest?.("a") ? target.closest(".menu-kat__pozycja") : null;
      if (menuItem) suspendCategoryMenu(menuItem);
    };
    void maybeLoadTrackingPanel();
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", onClick);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, show);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onClick);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, show);
    };
  }, []);

  // Audyt P1-10: zmiana trasy zamyka otwarte menu kategorii (fokus i kursor moga zostac na odnosniku w naglowku)
  const pathname = usePathname();
  useEffect(() => {
    document.querySelectorAll(".menu-kat__pozycja").forEach((item) => {
      if (item.matches(":hover") || item.contains(document.activeElement))
        suspendCategoryMenu(item);
    });
  }, [pathname]);

  if (!used) return null;
  return (
    <Suspense fallback={null}>
      <ShortcutsDialog open={open} onClose={() => setOpen(false)} />
    </Suspense>
  );
}
