import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { getFocusable } from "./focus.js";
import { isTopOverlay, lockScroll, pushOverlay, removeOverlay, unlockScroll } from "./stack.js";

export interface OverlayBehaviorOptions {
  /** Nakladka jest otwarta i jej panel jest w drzewie. */
  active: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /**
   * Modalna (szuflada, okno): blokada przewijania i pulapka fokusu takze przy zmianie fokusu mysza.
   * Niemodalna (menu): tylko Esc, fokus na wejsciu i powrot fokusu.
   */
  modal: boolean;
  /** Element, ktory dostaje fokus po otwarciu (domyslnie pierwszy element interaktywny, potem panel). */
  initialFocusRef?: RefObject<HTMLElement | null> | undefined;
  /** Element, do ktorego wraca fokus po zamknieciu (domyslnie ten, ktory mial fokus przed otwarciem). */
  returnFocusRef?: RefObject<HTMLElement | null> | undefined;
  /** Gdy ref.current === false, fokus nie wraca (np. menu zamkniete klikniem w inne pole). */
  restoreFocusRef?: RefObject<boolean> | undefined;
}

/**
 * Wspolne zachowanie nakladek (docs/11 pkt 12): Esc, fokus na wejsciu, powrot fokusu do wywolujacego,
 * blokada przewijania i utrzymanie fokusu w panelu. Obsluguje tylko gorna nakladke stosu.
 */
export function useOverlayBehavior({
  active,
  panelRef,
  onClose,
  modal,
  initialFocusRef,
  returnFocusRef,
  restoreFocusRef,
}: OverlayBehaviorOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = pushOverlay();
    if (modal) lockScroll();

    const target = initialFocusRef?.current ?? getFocusable(panel)[0] ?? panel;
    target.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && isTopOverlay(id)) {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!isTopOverlay(id)) return;
      if (e.target instanceof Node && !panel.contains(e.target)) {
        (getFocusable(panel)[0] ?? panel).focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    if (modal) document.addEventListener("focusin", onFocusIn);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      removeOverlay(id);
      if (modal) unlockScroll();
      const back = returnFocusRef?.current ?? previous;
      if (restoreFocusRef?.current !== false && back?.isConnected)
        back.focus({ preventScroll: true });
    };
    // initialFocusRef, returnFocusRef i restoreFocusRef to refy: ich zmiana nie restartuje nakladki
  }, [active, modal, panelRef]);
}
