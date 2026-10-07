import { useId, useRef } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { Button } from "../components/button.js";
import type { ButtonProps } from "../components/button.js";
import { cx } from "../lib/cx.js";
import { getFocusable } from "./focus.js";
import { useOverlayBehavior } from "./use-overlay-behavior.js";
import { usePresence } from "./use-presence.js";
import { useControllableOpen } from "./use-controllable-open.js";

export interface MenuProps {
  /** Etykieta przycisku otwierajacego (tekst, nie sama ikona). */
  label: ReactNode;
  /** Nazwa dostepna panelu; domyslnie brak (panel jest grupa pod przyciskiem). */
  panelLabel?: string;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerVariant?: ButtonProps["variant"];
  className?: string;
}

/**
 * Menu rozwijane (A-12: opacity + translateY(-4px)): przycisk z aria-expanded i panel pod nim.
 * Wzorzec "disclosure": Esc zamyka i oddaje fokus przyciskowi, klikniecie poza panelem i wyjscie
 * fokusu Tab-em zamykaja bez kradzenia fokusu, strzalki przechodza po pozycjach.
 */
export function Menu({
  label,
  panelLabel,
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  triggerVariant = "secondary",
  className,
}: MenuProps) {
  const panelId = useId();
  const [open, setOpen] = useControllableOpen(openProp, defaultOpen ?? false, onOpenChange);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(true);

  const presence = usePresence(open, panelRef);
  const close = () => setOpen(false);
  useOverlayBehavior({
    active: open,
    panelRef,
    onClose: close,
    modal: false,
    returnFocusRef: triggerRef,
    restoreFocusRef: restoreFocus,
  });

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const items = getFocusable(e.currentTarget);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (e.key === "ArrowDown") next = (i + 1) % items.length;
    else if (e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
    else if (e.key === "End") next = items.length - 1;
    items[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={cx("tk-menu", className)}
      onPointerDownCapture={(e) => {
        // Klikniecie poza menu: zamknij, ale nie odbieraj fokusu elementowi, w ktory kliknieto.
        if (open && !rootRef.current?.contains(e.target as Node)) {
          restoreFocus.current = false;
          close();
        }
      }}
      onBlur={(e) => {
        if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget as Node)) {
          restoreFocus.current = false;
          close();
        }
      }}
    >
      <Button
        ref={triggerRef}
        variant={triggerVariant}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          restoreFocus.current = true;
          setOpen(!open);
        }}
      >
        {label}
      </Button>
      <div
        id={panelId}
        ref={panelRef}
        role="group"
        aria-label={panelLabel}
        className="tk-menu__panel"
        data-stan={presence.closing ? "zamykanie" : "otwarty"}
        data-anim={presence.animating ? "" : undefined}
        hidden={!presence.visible || undefined}
        onKeyDown={onPanelKeyDown}
        onAnimationEnd={presence.onAnimationEnd}
        onClick={(e) => {
          // Wybor pozycji zamyka menu i oddaje fokus przyciskowi.
          if ((e.target as HTMLElement).closest(".tk-menu__pozycja")) {
            restoreFocus.current = true;
            close();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Pozycja menu: odnosnik (nawigacja) albo przycisk (akcja); 44 px wysokosci. */
export function MenuLink({ className, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...rest} className={cx("tk-menu__pozycja", className)} />;
}

export function MenuButton({
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} type={type} className={cx("tk-menu__pozycja", className)} />;
}
