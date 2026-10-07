import { cx } from "../lib/cx.js";
import { useKeyPress } from "../lib/use-key-press.js";

export interface QuantityProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Nazwa grupy, np. "Ilość: Bazalt 75". */
  label?: string;
  className?: string;
}

function Krok({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const key = useKeyPress(disabled);
  return (
    <button
      type="button"
      className={cx("tk-ikonka", "tk-ilosc__krok", key.pressed && "is-wcisniety")}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={key.onKeyDown}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

/**
 * Licznik ilosci: minus, liczba, plus; kazdy 44 x 44; na granicy przycisk nieaktywny (docs/06 §5).
 * Znaki + i − to tekst (D-007), wiec licznik dziala tez bez fontu ikon.
 */
export function Quantity({
  value,
  onChange,
  min = 1,
  max = 99,
  label = "Ilość",
  className,
}: QuantityProps) {
  return (
    <div role="group" aria-label={label} className={cx("tk-ilosc", className)}>
      <Krok
        label="Zmniejsz ilość"
        glyph="−"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      />
      <output className="tk-ilosc__wartosc" aria-live="polite">
        {value}
      </output>
      <Krok
        label="Zwiększ ilość"
        glyph="+"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      />
    </div>
  );
}
