import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx.js";

export type BadgeVariant = "nowosc" | "bestseller" | "promocja" | "ostatnie-sztuki" | "brak";

const DOMYSLNE_ETYKIETY: Record<BadgeVariant, string> = {
  nowosc: "Nowość",
  bestseller: "Bestseller",
  promocja: "Promocja",
  "ostatnie-sztuki": "Ostatnie sztuki",
  brak: "Brak",
};

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  variant: BadgeVariant;
  /** Nadpisuje domyslna etykiete (np. "-15%"). */
  children?: ReactNode;
}

/** Plakietka (docs/06 §5): --r-pelny, --t-xs 700. Kolor nie jest jedynym nosnikiem: zawsze tekst. */
export function Badge({ variant, className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx("tk-plakietka", `tk-plakietka--${variant}`, className)}>
      {children ?? DOMYSLNE_ETYKIETY[variant]}
    </span>
  );
}
