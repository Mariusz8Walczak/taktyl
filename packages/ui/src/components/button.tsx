import type { ButtonHTMLAttributes, ReactNode } from "react";
import { callAll } from "../lib/compose.js";
import { cx } from "../lib/cx.js";
import { useKeyPress } from "../lib/use-key-press.js";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = przycisk glowny (keycap, 1 wariant na ekran), secondary = poboczny. */
  variant?: "primary" | "secondary";
  /** Stan ladowania: etykieta zostaje dla czytnika (aria-busy), klikniecie jest blokowane. */
  loading?: boolean;
  children: ReactNode;
}

/**
 * Przycisk glowny i poboczny (docs/06 §5; wzorzec: przycisk glowny szablonu, docs/08).
 * A-01: wciśnięcie klawisza przy :active oraz przy Enter/Spacji (klasa is-wcisniety).
 */
export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  type = "button",
  onClick,
  onKeyDown,
  children,
  ...rest
}: ButtonProps) {
  const blocked = Boolean(disabled) || loading;
  const key = useKeyPress(blocked);
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={cx(
        "tk-btn",
        variant === "primary" ? "tk-btn--glowny" : "tk-btn--poboczny",
        key.pressed && "is-wcisniety",
        loading && "is-ladowanie",
        className,
      )}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      onKeyDown={callAll(onKeyDown, key.onKeyDown)}
    >
      {children}
    </button>
  );
}
