import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "../lib/cx.js";
import { trapTab } from "./focus.js";
import { useOverlayBehavior } from "./use-overlay-behavior.js";
import { usePresence } from "./use-presence.js";

export interface OverlayProps {
  /** drawer = szuflada z boku (A-12: translateX), dialog = okno (A-12: opacity + scale). */
  kind: "drawer" | "dialog";
  open: boolean;
  onClose: () => void;
  /** Widoczny naglowek; jest tez nazwa dostepna nakladki (aria-labelledby). */
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Strona szuflady (domyslnie prawa, jak szuflada koszyka). */
  side?: "right" | "left";
  /** Klikniecie w tlo zamyka (domyslnie tak). */
  closeOnBackdrop?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Gdy nie podano, fokus wraca do elementu, ktory mial go przed otwarciem. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Zostawia zamknieta nakladke w drzewie z atrybutem hidden (SSR, zachowanie stanu formularza). */
  keepMounted?: boolean;
  closeLabel?: string;
  className?: string;
}

/**
 * Wspolny modul nakladek (TAKTYL-25, docs/11 pkt 12): pulapka fokusu, Esc, zamykanie na tlo, powrot fokusu
 * do wywolujacego, blokada przewijania, 100dvh. Ruch A-12 tylko transform i opacity, czasy z tokenow,
 * wylaczony przy prefers-reduced-motion. Wzorzec: koszyk wyskakujacy i okna szablonu (docs/08).
 */
export function Overlay({
  kind,
  open,
  onClose,
  title,
  children,
  footer,
  side = "right",
  closeOnBackdrop = true,
  initialFocusRef,
  returnFocusRef,
  keepMounted = false,
  closeLabel = "Zamknij",
  className,
}: OverlayProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [client, setClient] = useState(false);
  useEffect(() => setClient(true), []);

  const presence = usePresence(open, panelRef);
  useOverlayBehavior({
    active: open && client,
    panelRef,
    onClose,
    modal: true,
    initialFocusRef,
    returnFocusRef,
  });

  if (!client) return null;
  if (!presence.visible && !keepMounted) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (panelRef.current) trapTab(e, panelRef.current);
  };

  return createPortal(
    <div
      className={cx(
        "tk-overlay",
        kind === "drawer" ? "tk-overlay--szuflada" : "tk-overlay--okno",
        kind === "drawer" && side === "left" && "tk-overlay--lewa",
        className,
      )}
      data-stan={presence.closing ? "zamykanie" : "otwarty"}
      data-anim={presence.animating ? "" : undefined}
      hidden={!presence.visible || undefined}
    >
      <div
        className="tk-overlay__tlo"
        data-testid="tk-tlo"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="tk-overlay__panel"
        onKeyDown={onKeyDown}
        onAnimationEnd={presence.onAnimationEnd}
      >
        <div className="tk-overlay__naglowek">
          <h2 id={titleId} className="tk-overlay__tytul">
            {title}
          </h2>
          {/* D-010 (TAKTYL-68): widoczna etykieta tekstowa zamiast ikony (font ikon nie jest w repo); nazwa dostepna zawiera ten tekst (WCAG 2.5.3). */}
          <button
            type="button"
            className="tk-ikonka tk-overlay__zamknij"
            aria-label={closeLabel}
            onClick={onClose}
          >
            Zamknij
          </button>
        </div>
        <div className="tk-overlay__tresc">{children}</div>
        {footer ? <div className="tk-overlay__stopka">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export type DrawerProps = Omit<OverlayProps, "kind">;

/** Szuflada z boku (koszyk, filtry). A-12: translateX. */
export function Drawer(props: DrawerProps) {
  return <Overlay {...props} kind="drawer" />;
}

/** Okno dialogowe. A-12: opacity + scale. */
export function Dialog(props: DrawerProps) {
  return <Overlay {...props} kind="dialog" />;
}
