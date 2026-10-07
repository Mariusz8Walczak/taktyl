import type { CSSProperties, InputHTMLAttributes } from "react";
import { cx } from "../lib/cx.js";

export interface SwatchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Nazwa koloru, zawsze widoczna (kolor nie jest jedynym nosnikiem). */
  label: string;
  /** Wartosc z data/colors.json -> swatch (jedyny dozwolony kolor poza tokenami). */
  swatch: string;
  /** Wariant niedostepny: przekreslenie ukosne i "Brak" w etykiecie. */
  unavailable?: boolean;
}

/**
 * Probka koloru jako radio (A-05): kolo --r-pelny, wybrana ma pierscien --akcent i pogrubiona nazwe.
 * Dla grupy podaj wspolne name; calosc owijaj w fieldset z legenda.
 */
export function Swatch({
  label,
  swatch,
  unavailable = false,
  className,
  disabled,
  ...rest
}: SwatchProps) {
  const style = { "--tk-swatch": swatch } as CSSProperties;
  return (
    <label className={cx("tk-probka", unavailable && "is-brak", className)}>
      <input
        {...rest}
        type="radio"
        className="tk-probka__input"
        disabled={disabled || unavailable}
      />
      <span className="tk-probka__kolo" style={style} aria-hidden="true" />
      <span className="tk-probka__nazwa">
        {label}
        {unavailable ? <span className="tk-probka__brak">Brak</span> : null}
      </span>
    </label>
  );
}
