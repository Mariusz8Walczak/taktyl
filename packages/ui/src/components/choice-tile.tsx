import type { InputHTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx.js";
import { Icon } from "./icon.js";

export interface ChoiceTileProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "title"
> {
  title: ReactNode;
  description?: ReactNode;
  /** Wariant niedostepny: tlo --tlo-alt, tekst --tekst-slaby, "Brak". */
  unavailable?: boolean;
}

/**
 * Kafel wyboru (radio), A-05: wybrany ma obrys 2 px --akcent, tlo --akcent-slaby i znacznik w rogu
 * (znacznik, nie sam kolor, niesie informacje). Wzorzec: product-swatch-image (docs/08).
 */
export function ChoiceTile({
  title,
  description,
  unavailable = false,
  className,
  disabled,
  ...rest
}: ChoiceTileProps) {
  return (
    <label className={cx("tk-kafel", unavailable && "is-brak", className)}>
      <input
        {...rest}
        type="radio"
        className="tk-kafel__input"
        disabled={disabled || unavailable}
      />
      <span className="tk-kafel__tresc">
        <span className="tk-kafel__tytul">{title}</span>
        {description ? <span className="tk-kafel__opis">{description}</span> : null}
        {unavailable ? <span className="tk-kafel__brak">Brak</span> : null}
      </span>
      <span className="tk-kafel__znacznik" aria-hidden="true">
        <Icon name="check" />
      </span>
    </label>
  );
}
