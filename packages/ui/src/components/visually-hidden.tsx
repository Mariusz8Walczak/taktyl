import type { HTMLAttributes } from "react";
import { cx } from "../lib/cx.js";

/** Tekst tylko dla czytnika ekranu. */
export function VisuallyHidden({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...rest} className={cx("tk-sr-only", className)} />;
}
