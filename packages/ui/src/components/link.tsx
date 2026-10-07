import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cx } from "../lib/cx.js";

/** Odnosnik: kolor --akcent, w tekscie ciaglym podkreslony; najechanie pogrubia podkreslenie. */
export function Link({ className, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...rest} className={cx("tk-link", className)} />;
}

/** Przycisk wygladajacy jak odnosnik (akcja, nie przejscie). */
export function TextButton({
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} type={type} className={cx("tk-link", "tk-link--przycisk", className)} />;
}
