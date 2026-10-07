import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { joinIds } from "../lib/compose.js";
import { cx } from "../lib/cx.js";
import { Icon } from "./icon.js";

interface FieldBase {
  label: ReactNode;
  hint?: ReactNode;
  /** Komunikat bledu: obrys --blad, ikona + tekst pod polem, aria-invalid i aria-describedby. */
  error?: ReactNode;
  wrapperClassName?: string;
}

export type FieldProps =
  | (FieldBase & { as?: "input" } & InputHTMLAttributes<HTMLInputElement>)
  | (FieldBase & { as: "textarea" } & TextareaHTMLAttributes<HTMLTextAreaElement>)
  | (FieldBase & { as: "select" } & SelectHTMLAttributes<HTMLSelectElement>);

/**
 * Pole formularza: wysokosc 48 px, obrys 1 px --linia-pola, --r (docs/06 §5).
 * Etykieta zawsze nad polem (docs/11 pkt 19); podpowiedz jej nie zastepuje.
 */
export function Field(props: FieldProps) {
  const {
    label,
    hint,
    error,
    wrapperClassName,
    as = "input",
    id: idProp,
    className,
    ...rest
  } = props;
  const auto = useId();
  const id = idProp ?? `pole-${auto}`;
  const hintId = hint ? `${id}-podpowiedz` : undefined;
  const errorId = error ? `${id}-blad` : undefined;
  const common = {
    id,
    className: cx("tk-pole__kontrolka", className),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": joinIds(
      (rest as { "aria-describedby"?: string })["aria-describedby"],
      hintId,
      errorId,
    ),
  };
  let control: ReactNode;
  if (as === "textarea") {
    control = <textarea {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} {...common} />;
  } else if (as === "select") {
    control = <select {...(rest as SelectHTMLAttributes<HTMLSelectElement>)} {...common} />;
  } else {
    control = <input {...(rest as InputHTMLAttributes<HTMLInputElement>)} {...common} />;
  }
  return (
    <div className={cx("tk-pole", error ? "is-blad" : undefined, wrapperClassName)}>
      <label className="tk-pole__etykieta" htmlFor={id}>
        {label}
      </label>
      {control}
      {hint ? (
        <p className="tk-pole__podpowiedz" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="tk-pole__blad" id={errorId}>
          <Icon name="error" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
