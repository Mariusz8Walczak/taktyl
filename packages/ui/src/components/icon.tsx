import { cx } from "../lib/cx.js";

/**
 * Nazwy ikon z listy docs/09 §2. Komponent nie rysuje niczego: renderuje span z klasa,
 * a glify dostarcza font ikon szablonu przez lokalny overlay (ADR-0004, plik poza repo).
 */
export const ICON_NAMES = [
  "search",
  "heart",
  "compare",
  "cart",
  "user",
  "menu",
  "close",
  "arrow-left",
  "arrow-right",
  "arrow-up",
  "arrow-down",
  "plus",
  "minus",
  "check",
  "warning",
  "info",
  "error",
  "filter",
  "sort",
  "delivery",
  "return",
  "shield",
  "clock",
  "copy-link",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export interface IconProps {
  name: IconName;
  /** m = 20 px (przyciski), l = 24 px (pasek warunkow). */
  size?: "m" | "l";
  className?: string;
}

/** Ikona dekoracyjna: zawsze aria-hidden (docs/09 §2). Ikona bez tekstu wymaga aria-label na przycisku. */
export function Icon({ name, size = "m", className }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cx("tk-icon", `tk-icon--${name}`, size === "l" && "tk-icon--l", className)}
    />
  );
}
