import type { HTMLAttributes } from "react";
import { cx } from "../lib/cx.js";

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** A-17: skrot zostal uzyty, klawisz wciska sie jak A-01. */
  pressed?: boolean;
}

/** Klawisz <kbd> (docs/06 §5): wysokosc 28 px, dolna krawedz 2 px. */
export function Kbd({ pressed, className, ...rest }: KbdProps) {
  return <kbd {...rest} className={cx("tk-kbd", pressed && "is-wcisniety", className)} />;
}
